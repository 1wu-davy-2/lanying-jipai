from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models.order import Order, OrderLog
from app.models.user import User
from app.models.wallet import Withdrawal
from app.routers.orders import get_order, new_published_order, serialize_order
from app.schemas.order import AdminOrderCreateRequest, ArbitrationRequest, RejectOrderRequest, ShipmentRequest
from app.services.order_service import OrderConflictError, transition_order
from app.services.wallet_service import WalletConflictError, complete_order_and_settle

router = APIRouter(prefix="/admin", tags=["admin"])


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
