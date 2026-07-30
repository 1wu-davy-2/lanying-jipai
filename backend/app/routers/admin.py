from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models.order import Order, OrderApplication, OrderLog
from app.models.script import ScriptCategory, ScriptDocument
from app.models.user import User
from app.models.wallet import Withdrawal
from app.routers.orders import get_order, new_published_order, serialize_order
from app.schemas.order import AdminOrderCreateRequest, ApplicationReviewRequest, ArbitrationRequest, RejectOrderRequest, ShipmentRequest
from app.services.order_service import OrderConflictError, approve_order_application, transition_order
from app.services.talent_level import talent_status
from app.services.wallet_service import WalletConflictError, complete_order_and_settle

router = APIRouter(prefix="/admin", tags=["admin"])


def serialize_script_category(category: ScriptCategory) -> dict[str, object]:
    return {
        "id": category.id,
        "code": category.code,
        "name": category.name,
        "description": category.description,
        "is_restricted": category.is_restricted,
    }


def serialize_script_document(document: ScriptDocument, include_body: bool = False) -> dict[str, object]:
    data: dict[str, object] = {
        "id": document.id,
        "title": document.title,
        "source_key": document.source_key,
        "source_filename": document.source_filename,
        "section_count": document.section_count,
        "copy_block_count": document.copy_block_count,
        "category": serialize_script_category(document.category),
    }
    if include_body:
        data["markdown_body"] = document.markdown_body
    return data


@router.get("/scripts/categories")
def list_script_categories(
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    categories = list(session.scalars(select(ScriptCategory).order_by(ScriptCategory.display_order.asc())))
    return {"code": 0, "message": "ok", "data": [serialize_script_category(category) for category in categories]}


@router.get("/scripts")
def list_scripts(
    category: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(ScriptDocument).join(ScriptCategory)
    count_statement = select(func.count()).select_from(ScriptDocument).join(ScriptCategory)
    filters = []
    if category:
        filters.append(ScriptCategory.code == category)
    normalized_keyword = (keyword or "").strip()
    if normalized_keyword:
        filters.append(
            or_(
                ScriptCategory.name.contains(normalized_keyword),
                ScriptDocument.title.contains(normalized_keyword),
                ScriptDocument.source_filename.contains(normalized_keyword),
                ScriptDocument.markdown_body.contains(normalized_keyword),
            )
        )
    if filters:
        statement = statement.where(*filters)
        count_statement = count_statement.where(*filters)
    total = session.scalar(count_statement) or 0
    documents = list(
        session.scalars(
            statement.order_by(ScriptCategory.display_order.asc(), ScriptDocument.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [serialize_script_document(document) for document in documents],
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    }


@router.get("/scripts/{document_id}")
def read_script_document(
    document_id: int,
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    document = session.get(ScriptDocument, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="话术文档不存在")
    return {"code": 0, "message": "ok", "data": serialize_script_document(document, include_body=True)}


def serialize_application(application: OrderApplication, session: Session) -> dict[str, object]:
    applicant = session.get(User, application.model_id)
    order = session.get(Order, application.order_id)
    return {
        "id": application.id,
        "status": application.status,
        "message": application.message,
        "review_reason": application.review_reason,
        "created_at": application.created_at.isoformat() if application.created_at else None,
        "reviewed_at": application.reviewed_at.isoformat() if application.reviewed_at else None,
        "applicant": None if applicant is None else {
            "id": applicant.id,
            "nickname": applicant.nickname,
            "avatar_url": applicant.avatar_url,
            "verify_status": applicant.verify_status,
            "level": talent_status(session, applicant)["level"]["code"],
        },
        "order": serialize_order(order) if order else None,
    }


@router.get("/order-applications")
def list_order_applications(
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(OrderApplication)
    if status_filter:
        statement = statement.where(OrderApplication.status == status_filter)
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    applications = list(session.scalars(statement.order_by(OrderApplication.created_at.asc(), OrderApplication.id.asc()).offset((page - 1) * page_size).limit(page_size)))
    return {"code": 0, "message": "ok", "data": {"items": [serialize_application(item, session) for item in applications], "total": total, "page": page, "page_size": page_size}}


@router.put("/order-applications/{application_id}/review")
def review_order_application(
    application_id: int,
    payload: ApplicationReviewRequest,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    application = session.get(OrderApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="申请记录不存在")
    if application.status != "PENDING":
        raise HTTPException(status_code=409, detail="该申请已处理")
    try:
        if payload.approved:
            approve_order_application(session, application, admin.id)
        else:
            result = session.execute(
                update(OrderApplication)
                .where(OrderApplication.id == application.id, OrderApplication.status == "PENDING")
                .values(
                    status="REJECTED",
                    reviewer_id=admin.id,
                    reviewed_at=datetime.now(timezone.utc),
                    review_reason=payload.reason.strip() if payload.reason else None,
                )
            )
            if result.rowcount != 1:
                raise OrderConflictError("该申请已处理")
            session.expire(application)
        session.commit()
        session.refresh(application)
    except OrderConflictError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"code": 0, "message": "审核完成", "data": serialize_application(application, session)}


def orders_page(
    session: Session,
    status_filter: str | None,
    keyword: str | None,
    overdue: bool,
    merchant_id: int | None,
    page: int,
    page_size: int,
) -> dict[str, object]:
    statement = select(Order)
    count_statement = select(func.count()).select_from(Order)
    filters = []
    if status_filter:
        filters.append(Order.status == status_filter)
    if keyword:
        filters.append(or_(Order.order_no.contains(keyword), Order.title.contains(keyword)))
    if overdue:
        threshold = datetime.utcnow() - timedelta(hours=72)
        filters.extend([Order.status.in_(("CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED")), Order.updated_at < threshold])
    if merchant_id is not None:
        filters.append(Order.merchant_id == merchant_id)
    if filters:
        statement = statement.where(*filters)
        count_statement = count_statement.where(*filters)
    orders = list(session.scalars(statement.order_by(Order.created_at.desc(), Order.id.desc()).offset((page - 1) * page_size).limit(page_size)))
    total = session.scalar(count_statement) or 0
    return {"items": [serialize_order(order) for order in orders], "total": total, "page": page, "page_size": page_size}


@router.get("/orders")
def list_orders(
    status_filter: str | None = None,
    keyword: str | None = None,
    overdue: bool = False,
    merchant_id: int | None = Query(default=None, ge=1),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    return {"code": 0, "message": "ok", "data": orders_page(session, status_filter, keyword, overdue, merchant_id, page, page_size)}


@router.post("/orders", status_code=status.HTTP_201_CREATED)
def create_merchant_order(
    payload: AdminOrderCreateRequest,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    merchant = session.get(User, payload.merchant_id)
    if merchant is None:
        raise HTTPException(status_code=404, detail="商家不存在")
    if merchant.role != "merchant":
        raise HTTPException(status_code=400, detail="目标用户不是商家")
    if merchant.status != "active":
        raise HTTPException(status_code=409, detail="目标商家已被禁用")
    order = new_published_order(payload, merchant.id)
    session.add(order)
    session.flush()
    session.add(
        OrderLog(
            order_id=order.id,
            operator_id=admin.id,
            from_status=None,
            to_status="PUBLISHED",
            remark=f"运营代商家 {merchant.nickname} 发布订单",
        )
    )
    session.commit()
    session.refresh(order)
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.get("/orders/disputed")
def list_disputed_orders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    return {"code": 0, "message": "ok", "data": orders_page(session, "DISPUTED", None, False, None, page, page_size)}


def operate_for_merchant(
    session: Session,
    order: Order,
    target_status: str,
    admin: User,
    remark: str,
    changes: dict[str, object] | None = None,
) -> dict[str, object]:
    try:
        transition_order(session, order, target_status, admin.id, remark, changes)
        session.commit()
        session.refresh(order)
    except OrderConflictError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.put("/orders/{order_id}/ship")
def ship_order_for_merchant(
    order_id: int,
    payload: ShipmentRequest,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    return operate_for_merchant(
        session,
        order,
        "SHIPPED_TO_MODEL",
        admin,
        "运营代商家寄出样品",
        {"ship_to_model_tracking_no": payload.tracking_no, "ship_to_model_company": payload.company},
    )


@router.put("/orders/{order_id}/accept")
def accept_order_for_merchant(
    order_id: int,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    try:
        complete_order_and_settle(session, order, admin.id, "运营代商家验收通过并完成结算")
        session.commit()
        session.refresh(order)
    except (OrderConflictError, WalletConflictError, IntegrityError) as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc) or "订单结算失败") from exc
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.put("/orders/{order_id}/reject")
def reject_order_for_merchant(
    order_id: int,
    payload: RejectOrderRequest,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    return operate_for_merchant(session, order, "DISPUTED", admin, "运营代商家发起争议", {"reject_reason": payload.reason})


@router.put("/orders/{order_id}/cancel")
def cancel_order_for_merchant(
    order_id: int,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    return operate_for_merchant(session, get_order(session, order_id), "CANCELLED", admin, "运营代商家撤回订单")


@router.put("/orders/{order_id}/arbitrate")
def arbitrate_order(
    order_id: int,
    payload: ArbitrationRequest,
    admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    try:
        if payload.winner == "model":
            complete_order_and_settle(session, order, admin.id, f"管理员仲裁判达人：{payload.remark}")
        else:
            transition_order(session, order, "CANCELLED", admin.id, f"管理员仲裁判商家：{payload.remark}")
        session.commit()
        session.refresh(order)
    except (OrderConflictError, WalletConflictError, IntegrityError) as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc) or "订单仲裁失败") from exc
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.get("/dashboard/summary")
def dashboard_summary(
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    today_orders = session.scalar(select(func.count()).select_from(Order).where(Order.created_at >= today_start)) or 0
    month_orders = session.scalar(select(func.count()).select_from(Order).where(Order.created_at >= month_start)) or 0
    completed_amount = session.scalar(select(func.coalesce(func.sum(Order.commission_amount), 0)).where(Order.status == "COMPLETED", Order.completed_at >= month_start)) or Decimal("0.00")
    pending_withdrawals = session.scalar(select(func.count()).select_from(Withdrawal).where(Withdrawal.status == "pending")) or 0
    disputed_orders = session.scalar(select(func.count()).select_from(Order).where(Order.status == "DISPUTED")) or 0
    return {"code": 0, "message": "ok", "data": {"today_orders": today_orders, "month_orders": month_orders, "month_completed_amount": f"{completed_amount:.2f}", "pending_withdrawals": pending_withdrawals, "disputed_orders": disputed_orders}}
