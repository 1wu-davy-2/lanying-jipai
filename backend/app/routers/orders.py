import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.media import MediaAsset
from app.models.order import FulfillmentSubmission, Order, OrderApplication, OrderFulfillment, OrderLog, OrderMessage
from app.models.user import User
from app.product_categories import PRODUCT_CATEGORIES
from app.schemas.order import (
    OrderCreateRequest,
    OrderApplicationRequest,
    FulfillmentSubmissionRequest,
    FulfillmentSubmissionReviewRequest,
    OrderMessageRequest,
    OwnedProductReviewRequest,
    RejectOrderRequest,
    ShipmentRequest,
    SubmitOrderRequest,
)
from app.services.order_service import OrderConflictError, transition_order
from app.services.talent_level import claim_block_reason
from app.services.wallet_service import WalletConflictError, complete_fulfillment_and_settle, complete_order_and_settle
from app.utils.order_no import new_order_no

router = APIRouter(prefix="/orders", tags=["orders"])

# A dispute is a review/acceptance escalation, not a shortcut around the
# assignment and shipping steps.  Keeping this list explicit also prevents a
# model or merchant from freezing an order while it is still being allocated.
DISPUTABLE_FULFILLMENT_STATUSES = {
    "SUBMITTED",
    "REVISION_REQUIRED",
    "WAITING_RETURN",
    "RETURNED",
}


def order_categories(order: Order) -> list[str]:
    return json.loads(order.product_categories or "[]")


def serialize_order(order: Order) -> dict[str, object]:
    return {
        "id": order.id,
        "order_no": order.order_no,
        "merchant_id": order.merchant_id,
        "model_id": order.model_id,
        "title": order.title,
        "description": order.description,
        "product_categories": order_categories(order),
        "sample_images": json.loads(order.sample_images or "[]"),
        "order_type": order.order_type,
        "quantity": order.quantity,
        "required_media_count": order.required_media_count,
        "delivery_days": order.delivery_days,
        "deposit_required": order.deposit_required,
        "return_required": order.return_required,
        "product_source": order.product_source,
        "product_subsidy_amount": str(order.product_subsidy_amount),
        "self_keep_after_shoot": order.self_keep_after_shoot,
        "commission_amount": str(order.commission_amount),
        "deposit_amount": str(order.deposit_amount),
        "shoot_requirements": order.shoot_requirements,
        "status": order.status,
        "ship_to_model_tracking_no": order.ship_to_model_tracking_no,
        "ship_to_model_company": order.ship_to_model_company,
        "return_tracking_no": order.return_tracking_no,
        "return_company": order.return_company,
        "submitted_media": json.loads(order.submitted_media or "[]"),
        "reject_reason": order.reject_reason,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


def _time_value(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def serialize_submission(submission: FulfillmentSubmission) -> dict[str, object]:
    return {
        "id": submission.id,
        "fulfillment_id": submission.fulfillment_id,
        "version": submission.version,
        "status": submission.status,
        "media_urls": json.loads(submission.media_urls or "[]"),
        "remark": submission.remark,
        "review_reason": submission.review_reason,
        "reviewer_id": submission.reviewer_id,
        "submitted_at": _time_value(submission.submitted_at),
        "reviewed_at": _time_value(submission.reviewed_at),
        "created_at": _time_value(submission.created_at),
    }


def serialize_message(message: OrderMessage, session: Session) -> dict[str, object]:
    sender = session.get(User, message.sender_id)
    return {
        "id": message.id,
        "order_id": message.order_id,
        "fulfillment_id": message.fulfillment_id,
        "sender_id": message.sender_id,
        "content": message.content,
        "created_at": _time_value(message.created_at),
        "sender": None
        if sender is None
        else {
            "id": sender.id,
            "nickname": sender.nickname,
            "avatar_url": sender.avatar_url,
            "role": sender.role,
        },
    }


def serialize_fulfillment(
    fulfillment: OrderFulfillment,
    session: Session,
    include_submissions: bool = True,
) -> dict[str, object]:
    model = session.get(User, fulfillment.model_id)
    application = session.get(OrderApplication, fulfillment.application_id)
    order = session.get(Order, fulfillment.order_id)
    data: dict[str, object] = {
        "id": fulfillment.id,
        "order_id": fulfillment.order_id,
        "application_id": fulfillment.application_id,
        "slot_no": fulfillment.slot_no,
        "status": fulfillment.status,
        "product_source": fulfillment.product_source,
        "return_required": fulfillment.return_required,
        "self_keep_after_shoot": fulfillment.self_keep_after_shoot,
        "commission_amount": str(fulfillment.commission_amount),
        "product_subsidy_amount": str(fulfillment.product_subsidy_amount),
        "ship_to_model_tracking_no": fulfillment.ship_to_model_tracking_no,
        "ship_to_model_company": fulfillment.ship_to_model_company,
        "return_tracking_no": fulfillment.return_tracking_no,
        "return_company": fulfillment.return_company,
        "reject_reason": fulfillment.reject_reason,
        "claimed_at": _time_value(fulfillment.claimed_at),
        "shipped_at": _time_value(fulfillment.shipped_at),
        "in_progress_at": _time_value(fulfillment.in_progress_at),
        "submitted_at": _time_value(fulfillment.submitted_at),
        "reviewed_at": _time_value(fulfillment.reviewed_at),
        "returned_at": _time_value(fulfillment.returned_at),
        "completed_at": _time_value(fulfillment.completed_at),
        "created_at": _time_value(fulfillment.created_at),
        "order": None
        if order is None
        else {
            "id": order.id,
            "order_no": order.order_no,
            "title": order.title,
            "description": order.description,
            "required_media_count": order.required_media_count,
            "sample_images": json.loads(order.sample_images or "[]"),
        },
        "model": None
        if model is None
        else {
            "id": model.id,
            "nickname": model.nickname,
            "avatar_url": model.avatar_url,
            "verify_status": model.verify_status,
        },
        "application": None
        if application is None
        else {
            "id": application.id,
            "status": application.status,
            "message": application.message,
            "owned_product_images": json.loads(application.owned_product_images or "[]"),
            "review_reason": application.review_reason,
            "created_at": _time_value(application.created_at),
            "reviewed_at": _time_value(application.reviewed_at),
        },
    }
    if include_submissions:
        submissions = list(
            session.scalars(
                select(FulfillmentSubmission)
                .where(FulfillmentSubmission.fulfillment_id == fulfillment.id)
                .order_by(FulfillmentSubmission.version.desc())
            )
        )
        data["submissions"] = [serialize_submission(item) for item in submissions]
    return data


def serialize_application(application: OrderApplication, session: Session) -> dict[str, object]:
    model = session.get(User, application.model_id)
    fulfillment = session.scalar(
        select(OrderFulfillment).where(OrderFulfillment.application_id == application.id)
    )
    return {
        "id": application.id,
        "order_id": application.order_id,
        "model_id": application.model_id,
        "status": application.status,
        "message": application.message,
        "owned_product_images": json.loads(application.owned_product_images or "[]"),
        "review_reason": application.review_reason,
        "reviewer_id": application.reviewer_id,
        "created_at": _time_value(application.created_at),
        "reviewed_at": _time_value(application.reviewed_at),
        "applicant": None
        if model is None
        else {
            "id": model.id,
            "nickname": model.nickname,
            "avatar_url": model.avatar_url,
            "verify_status": model.verify_status,
        },
        "fulfillment": serialize_fulfillment(fulfillment, session) if fulfillment else None,
    }


def fulfillment_summary(order: Order, session: Session) -> dict[str, object]:
    fulfillments = list(
        session.scalars(select(OrderFulfillment).where(OrderFulfillment.order_id == order.id))
    )
    counts: dict[str, int] = {}
    for fulfillment in fulfillments:
        counts[fulfillment.status] = counts.get(fulfillment.status, 0) + 1
    allocated = sum(1 for fulfillment in fulfillments if fulfillment.status != "CANCELLED")
    pending_application_count = session.scalar(
        select(func.count()).select_from(OrderApplication).where(
            OrderApplication.order_id == order.id,
            OrderApplication.status == "PENDING",
        )
    ) or 0
    return {
        "quantity": order.quantity,
        "approved_quantity": allocated,
        "available_quantity": max(order.quantity - allocated, 0),
        "active_quantity": sum(
            count for item_status, count in counts.items() if item_status not in {"COMPLETED", "CANCELLED"}
        ),
        "submitted_quantity": counts.get("SUBMITTED", 0),
        "completed_quantity": counts.get("COMPLETED", 0),
        "pending_application_count": pending_application_count,
        "waiting_submission_count": counts.get("SUBMITTED", 0),
        "waiting_acceptance_count": counts.get("RETURNED", 0),
        "recruitment_status": "FULL" if allocated >= order.quantity else "OPEN" if order.status == "PUBLISHED" else "CLOSED",
        "status_counts": counts,
    }


def get_order(session: Session, order_id: int) -> Order:
    order = session.get(Order, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


def ensure_order_member(order: Order, user: User) -> None:
    if user.role == "admin":
        return
    if user.id not in {order.merchant_id, order.model_id}:
        raise HTTPException(status_code=403, detail="无权访问该订单")


def ensure_order_owner(order: Order, user: User, role: str) -> None:
    if user.role != role or (role == "merchant" and order.merchant_id != user.id) or (role == "model" and order.model_id != user.id):
        raise HTTPException(status_code=403, detail="无权操作该订单")


def ensure_legacy_single_order(order: Order) -> None:
    if order.quantity > 1:
        raise HTTPException(status_code=409, detail="多人订单必须按履约实例操作")


def ensure_workspace_access(order: Order, user: User, session: Session) -> None:
    if user.role == "admin" or (user.role == "merchant" and order.merchant_id == user.id):
        return
    if user.role == "model":
        application_id = session.scalar(
            select(OrderApplication.id).where(
                OrderApplication.order_id == order.id,
                OrderApplication.model_id == user.id,
            )
        )
        if application_id is not None:
            return
    raise HTTPException(status_code=403, detail="No access to this order workspace")


def get_fulfillment(session: Session, fulfillment_id: int) -> OrderFulfillment:
    fulfillment = session.get(OrderFulfillment, fulfillment_id)
    if fulfillment is None:
        raise HTTPException(status_code=404, detail="Fulfillment does not exist")
    return fulfillment


def ensure_fulfillment_access(fulfillment: OrderFulfillment, user: User, session: Session) -> Order:
    order = get_order(session, fulfillment.order_id)
    if user.role == "admin" or (user.role == "merchant" and order.merchant_id == user.id):
        return order
    if user.role == "model" and fulfillment.model_id == user.id:
        return order
    raise HTTPException(status_code=403, detail="No access to this fulfillment")


def advance(
    session: Session,
    order: Order,
    target: str,
    user: User,
    remark: str | None = None,
    changes: dict[str, object] | None = None,
) -> dict[str, object]:
    try:
        transition_order(session, order, target, user.id, remark, changes)
        session.commit()
        session.refresh(order)
    except OrderConflictError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


def new_published_order(payload: OrderCreateRequest, merchant_id: int) -> Order:
    return Order(
        order_no=new_order_no(),
        merchant_id=merchant_id,
        title=payload.title,
        description=payload.description,
        product_categories=json.dumps(payload.product_categories, ensure_ascii=False),
        sample_images=json.dumps(payload.sample_images),
        order_type=payload.order_type,
        quantity=payload.quantity,
        required_media_count=payload.required_media_count,
        delivery_days=payload.delivery_days,
        deposit_required=payload.deposit_required,
        return_required=payload.return_required,
        product_source=payload.product_source,
        product_subsidy_amount=payload.product_subsidy_amount,
        self_keep_after_shoot=payload.self_keep_after_shoot,
        commission_amount=payload.commission_amount,
        deposit_amount=payload.deposit_amount,
        shoot_requirements=payload.shoot_requirements,
        status="PUBLISHED",
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreateRequest,
    user: User = Depends(require_role("merchant")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = new_published_order(payload, user.id)
    session.add(order)
    session.commit()
    session.refresh(order)
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.get("/hall")
def order_hall(
    category: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    if category is not None and category not in PRODUCT_CATEGORIES:
        raise HTTPException(status_code=422, detail="商品分类不支持")
    statement = select(Order).where(Order.status == "PUBLISHED").order_by(Order.created_at.desc())
    orders = list(session.scalars(statement))
    if category is not None:
        orders = [order for order in orders if category in order_categories(order)]
    total = len(orders)
    items = orders[(page - 1) * page_size : page * page_size]
    application_statuses = {
        item.order_id: item.status
        for item in session.scalars(
            select(OrderApplication).where(OrderApplication.model_id == user.id, OrderApplication.order_id.in_([order.id for order in items]))
        )
    } if items else {}
    serialized_items = []
    for order in items:
        data = serialize_order(order)
        data["application_status"] = application_statuses.get(order.id)
        data["merchant"] = public_merchant(order, session)
        serialized_items.append(data)
    return {"code": 0, "message": "ok", "data": {"items": serialized_items, "total": total, "page": page, "page_size": page_size}}


def public_merchant(order: Order, session: Session) -> dict[str, object] | None:
    merchant = session.get(User, order.merchant_id)
    if merchant is None:
        return None
    profile = merchant.merchant_profile
    return {
        "id": merchant.id,
        "nickname": merchant.nickname,
        "avatar_url": merchant.avatar_url,
        "shop_name": profile.shop_name if profile else merchant.nickname,
        "shop_platform": profile.shop_platform if profile else None,
        "quality_merchant": profile.quality_merchant if profile else False,
        "guarantee_deposit_paid": profile.guarantee_deposit_paid if profile else False,
        "guarantee_deposit_amount": str(profile.guarantee_deposit_amount) if profile else "0.00",
    }


@router.get("/hall/{order_id}")
def order_hall_detail(
    order_id: int,
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    if order.status != "PUBLISHED":
        raise HTTPException(status_code=409, detail="该订单已结束招募")
    data = serialize_order(order)
    application = session.scalar(select(OrderApplication).where(OrderApplication.order_id == order.id, OrderApplication.model_id == user.id))
    data["application_status"] = application.status if application else None
    data["application_reason"] = application.review_reason if application else None
    data["merchant"] = public_merchant(order, session)
    return {"code": 0, "message": "ok", "data": data}


@router.post("/{order_id}/applications", status_code=status.HTTP_201_CREATED)
def create_application(
    order_id: int,
    payload: OrderApplicationRequest,
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    if order.status != "PUBLISHED":
        raise HTTPException(status_code=409, detail="该订单已结束招募")
    reason = claim_block_reason(session, user, order.commission_amount)
    if reason:
        raise HTTPException(status_code=403, detail=reason)
    if order.product_source == "talent_owned" and not payload.owned_product_images:
        raise HTTPException(status_code=422, detail="已有同款订单必须上传同款实拍图供商家审核")
    if payload.owned_product_images:
        owned_assets = list(
            session.scalars(
                select(MediaAsset).where(MediaAsset.owner_id == user.id, MediaAsset.url.in_(payload.owned_product_images))
            )
        )
        if len(owned_assets) != len(set(payload.owned_product_images)) or len(payload.owned_product_images) != len(set(payload.owned_product_images)):
            raise HTTPException(status_code=422, detail="同款实拍图必须使用本人通过平台上传的图片")
        if any(not asset.content_type.startswith("image/") for asset in owned_assets):
            raise HTTPException(status_code=422, detail="同款实拍图只能使用图片文件")
    application = session.scalar(
        select(OrderApplication).where(OrderApplication.order_id == order.id, OrderApplication.model_id == user.id)
    )
    if application is not None and application.status != "REJECTED":
        raise HTTPException(status_code=409, detail="你已提交过该订单的申请")
    if application is None:
        application = OrderApplication(order_id=order.id, model_id=user.id)
        session.add(application)
    application.message = (payload.message or "").strip() or None
    application.owned_product_images = json.dumps(payload.owned_product_images)
    application.status = "PENDING"
    application.reviewer_id = None
    application.review_reason = None
    application.reviewed_at = None
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="你已提交过该订单的申请") from exc
    session.refresh(application)
    return {
        "code": 0,
        "message": "申请已提交，等待运营审核",
        "data": {
            "id": application.id,
            "order_id": application.order_id,
            "status": application.status,
            "message": application.message,
            "owned_product_images": payload.owned_product_images,
            "created_at": application.created_at.isoformat() if application.created_at else None,
        },
    }


@router.get("/my-applications")
def list_my_applications(
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    applications = list(session.scalars(select(OrderApplication).where(OrderApplication.model_id == user.id).order_by(OrderApplication.created_at.desc())))
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [
                {
                    "id": item.id,
                    "status": item.status,
                    "message": item.message,
                    "review_reason": item.review_reason,
                    "created_at": item.created_at.isoformat() if item.created_at else None,
                    "order": serialize_order(get_order(session, item.order_id)),
                }
                for item in applications
            ],
            "total": len(applications),
        },
    }


@router.post("/{order_id}/claim")
def claim(order_id: int, user: User = Depends(require_role("model")), session: Session = Depends(get_db)) -> dict[str, object]:
    # Keep the legacy endpoint explicit so clients cannot bypass operations review.
    raise HTTPException(status_code=409, detail="接单流程已改为申请审核，请提交接单申请")


@router.get("")
def list_my_orders(
    status_filter: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_role("merchant", "model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    if user.role == "model":
        statement = (
            select(OrderFulfillment, Order)
            .join(Order, Order.id == OrderFulfillment.order_id)
            .where(OrderFulfillment.model_id == user.id)
        )
        if status_filter:
            statement = statement.where(OrderFulfillment.status == status_filter)
        total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
        rows = session.execute(
            statement.order_by(OrderFulfillment.created_at.desc(), OrderFulfillment.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
        items: list[dict[str, object]] = []
        for fulfillment, order in rows:
            data = serialize_order(order)
            data.update(
                {
                    "fulfillment_id": fulfillment.id,
                    "slot_no": fulfillment.slot_no,
                    "fulfillment_status": fulfillment.status,
                    "commission_amount": str(fulfillment.commission_amount),
                    "product_subsidy_amount": str(fulfillment.product_subsidy_amount),
                }
            )
            items.append(data)
        return {"code": 0, "message": "ok", "data": {"items": items, "total": total, "page": page, "page_size": page_size}}

    statement = select(Order).where(Order.merchant_id == user.id)
    if status_filter:
        statement = statement.where(Order.status == status_filter)
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    orders = list(session.scalars(statement.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)))
    items = []
    for order in orders:
        data = serialize_order(order)
        data.update(fulfillment_summary(order, session))
        items.append(data)
    return {"code": 0, "message": "ok", "data": {"items": items, "total": total, "page": page, "page_size": page_size}}


@router.get("/{order_id}/workspace")
def order_workspace(
    order_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_workspace_access(order, user, session)
    applications_query = select(OrderApplication).where(OrderApplication.order_id == order.id)
    fulfillments_query = select(OrderFulfillment).where(OrderFulfillment.order_id == order.id)
    if user.role == "model":
        applications_query = applications_query.where(OrderApplication.model_id == user.id)
        fulfillments_query = fulfillments_query.where(OrderFulfillment.model_id == user.id)
    applications = list(session.scalars(applications_query.order_by(OrderApplication.created_at.asc())))
    fulfillments = list(session.scalars(fulfillments_query.order_by(OrderFulfillment.slot_no.asc())))
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "order": serialize_order(order),
            "summary": fulfillment_summary(order, session),
            "applications": [serialize_application(item, session) for item in applications],
            "fulfillments": [serialize_fulfillment(item, session) for item in fulfillments],
        },
    }


@router.get("/{order_id}/applications")
def list_order_applications(
    order_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    if user.role != "admin" and (user.role != "merchant" or user.id != order.merchant_id):
        raise HTTPException(status_code=403, detail="Only the merchant or admin can view applications")
    statement = select(OrderApplication).where(OrderApplication.order_id == order.id)
    if status_filter:
        statement = statement.where(OrderApplication.status == status_filter)
    applications = list(session.scalars(statement.order_by(OrderApplication.created_at.asc())))
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [serialize_application(item, session) for item in applications],
            "total": len(applications),
            "summary": fulfillment_summary(order, session),
        },
    }


@router.get("/{order_id}/fulfillments")
def list_order_fulfillments(
    order_id: int,
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    if user.role == "model":
        statement = select(OrderFulfillment).where(
            OrderFulfillment.order_id == order.id,
            OrderFulfillment.model_id == user.id,
        )
    elif user.role == "admin" or (user.role == "merchant" and user.id == order.merchant_id):
        statement = select(OrderFulfillment).where(OrderFulfillment.order_id == order.id)
    else:
        raise HTTPException(status_code=403, detail="No access to fulfillments")
    if status_filter:
        statement = statement.where(OrderFulfillment.status == status_filter)
    fulfillments = list(session.scalars(statement.order_by(OrderFulfillment.slot_no.asc())))
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [serialize_fulfillment(item, session) for item in fulfillments],
            "total": len(fulfillments),
            "summary": fulfillment_summary(order, session),
        },
    }


@router.get("/fulfillments/my")
def list_my_fulfillments(
    status_filter: str | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(OrderFulfillment).where(OrderFulfillment.model_id == user.id)
    if status_filter:
        statement = statement.where(OrderFulfillment.status == status_filter)
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    fulfillments = list(
        session.scalars(
            statement.order_by(OrderFulfillment.created_at.desc(), OrderFulfillment.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "items": [serialize_fulfillment(item, session) for item in fulfillments],
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    }


@router.get("/fulfillments/{fulfillment_id}")
def fulfillment_detail(
    fulfillment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    ensure_fulfillment_access(fulfillment, user, session)
    return {"code": 0, "message": "ok", "data": serialize_fulfillment(fulfillment, session)}


@router.post("/fulfillments/{fulfillment_id}/messages", status_code=status.HTTP_201_CREATED)
def create_fulfillment_message(
    fulfillment_id: int,
    payload: OrderMessageRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    ensure_fulfillment_access(fulfillment, user, session)
    message = OrderMessage(
        order_id=fulfillment.order_id,
        fulfillment_id=fulfillment.id,
        sender_id=user.id,
        content=payload.content,
    )
    session.add(message)
    session.commit()
    session.refresh(message)
    return {"code": 0, "message": "ok", "data": serialize_message(message, session)}


@router.get("/fulfillments/{fulfillment_id}/messages")
def list_fulfillment_messages(
    fulfillment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    ensure_fulfillment_access(fulfillment, user, session)
    messages = list(
        session.scalars(
            select(OrderMessage)
            .where(OrderMessage.fulfillment_id == fulfillment.id)
            .order_by(OrderMessage.created_at.asc(), OrderMessage.id.asc())
        )
    )
    return {
        "code": 0,
        "message": "ok",
        "data": {"items": [serialize_message(item, session) for item in messages], "total": len(messages)},
    }


@router.put("/fulfillments/{fulfillment_id}/ship")
def ship_fulfillment(
    fulfillment_id: int,
    payload: ShipmentRequest,
    user: User = Depends(require_role("merchant")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    order = ensure_fulfillment_access(fulfillment, user, session)
    if order.merchant_id != user.id or fulfillment.product_source != "merchant_ship":
        raise HTTPException(status_code=409, detail="This fulfillment does not require merchant shipment")
    if fulfillment.status != "CLAIMED":
        raise HTTPException(status_code=409, detail="Fulfillment is not waiting for shipment")
    now = datetime.now(timezone.utc)
    fulfillment.status = "SHIPPED_TO_MODEL"
    fulfillment.ship_to_model_tracking_no = payload.tracking_no
    fulfillment.ship_to_model_company = payload.company
    fulfillment.shipped_at = now
    session.commit()
    session.refresh(fulfillment)
    return {"code": 0, "message": "Shipment recorded", "data": serialize_fulfillment(fulfillment, session)}


@router.put("/fulfillments/{fulfillment_id}/receive")
def receive_fulfillment(
    fulfillment_id: int,
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    ensure_fulfillment_access(fulfillment, user, session)
    if fulfillment.status != "SHIPPED_TO_MODEL":
        raise HTTPException(status_code=409, detail="Fulfillment is not waiting for receipt")
    now = datetime.now(timezone.utc)
    fulfillment.status = "IN_PROGRESS"
    fulfillment.in_progress_at = now
    session.commit()
    session.refresh(fulfillment)
    return {"code": 0, "message": "Receipt recorded", "data": serialize_fulfillment(fulfillment, session)}


@router.put("/fulfillments/{fulfillment_id}/owned-product-review")
def review_fulfillment_owned_product(
    fulfillment_id: int,
    payload: OwnedProductReviewRequest,
    user: User = Depends(require_role("merchant")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    order = ensure_fulfillment_access(fulfillment, user, session)
    if order.merchant_id != user.id or fulfillment.product_source != "talent_owned":
        raise HTTPException(status_code=409, detail="This fulfillment does not require owned-product review")
    if fulfillment.status != "OWNED_PRODUCT_REVIEW":
        raise HTTPException(status_code=409, detail="Fulfillment is not waiting for owned-product review")
    application = session.get(OrderApplication, fulfillment.application_id)
    now = datetime.now(timezone.utc)
    if payload.approved:
        fulfillment.status = "IN_PROGRESS"
        fulfillment.in_progress_at = now
        if application:
            application.review_reason = "Owned-product review approved"
    else:
        fulfillment.status = "CANCELLED"
        fulfillment.slot_no = None
        fulfillment.reject_reason = (payload.reason or "").strip() or None
        if application:
            application.status = "REJECTED"
            application.review_reason = fulfillment.reject_reason
            application.reviewer_id = user.id
            application.reviewed_at = now
        if order.model_id == fulfillment.model_id:
            order.model_id = session.scalar(
                select(OrderFulfillment.model_id)
                .where(
                    OrderFulfillment.order_id == order.id,
                    OrderFulfillment.id != fulfillment.id,
                    OrderFulfillment.status != "CANCELLED",
                )
                .order_by(OrderFulfillment.slot_no.asc())
            )
        if order.status != "PUBLISHED":
            order.status = "PUBLISHED"
    session.commit()
    session.refresh(fulfillment)
    return {"code": 0, "message": "Owned-product review completed", "data": serialize_fulfillment(fulfillment, session)}


@router.put("/fulfillments/{fulfillment_id}/return")
def return_fulfillment(
    fulfillment_id: int,
    payload: ShipmentRequest,
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    ensure_fulfillment_access(fulfillment, user, session)
    if fulfillment.status != "WAITING_RETURN" or not fulfillment.return_required:
        raise HTTPException(status_code=409, detail="当前履约实例无需填写返货物流")
    now = datetime.now(timezone.utc)
    fulfillment.status = "RETURNED"
    fulfillment.return_tracking_no = payload.tracking_no
    fulfillment.return_company = payload.company
    fulfillment.returned_at = now
    session.commit()
    session.refresh(fulfillment)
    return {"code": 0, "message": "Return shipment recorded", "data": serialize_fulfillment(fulfillment, session)}


@router.put("/fulfillments/{fulfillment_id}/accept")
def accept_fulfillment(
    fulfillment_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    order = ensure_fulfillment_access(fulfillment, user, session)
    if user.role != "admin" and (user.role != "merchant" or user.id != order.merchant_id):
        raise HTTPException(status_code=403, detail="Only the merchant or admin can accept a fulfillment")
    try:
        complete_fulfillment_and_settle(session, fulfillment, user.id)
        session.commit()
        session.refresh(fulfillment)
    except (WalletConflictError, IntegrityError) as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc) or "履约结算失败") from exc
    return {"code": 0, "message": "Fulfillment accepted and settled", "data": serialize_fulfillment(fulfillment, session)}


@router.put("/fulfillments/{fulfillment_id}/dispute")
def dispute_fulfillment(
    fulfillment_id: int,
    payload: RejectOrderRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    order = ensure_fulfillment_access(fulfillment, user, session)
    if user.role not in {"admin", "merchant", "model"}:
        raise HTTPException(status_code=403, detail="No permission to dispute this fulfillment")
    if user.role == "merchant" and order.merchant_id != user.id:
        raise HTTPException(status_code=403, detail="No permission to dispute this fulfillment")
    if user.role == "model" and fulfillment.model_id != user.id:
        raise HTTPException(status_code=403, detail="No permission to dispute this fulfillment")
    if fulfillment.status == "DISPUTED":
        raise HTTPException(status_code=409, detail="该履约实例已进入争议处理")
    if fulfillment.status not in DISPUTABLE_FULFILLMENT_STATUSES:
        raise HTTPException(status_code=409, detail="当前履约阶段不能发起争议")
    fulfillment.status = "DISPUTED"
    fulfillment.reject_reason = payload.reason
    session.commit()
    session.refresh(fulfillment)
    return {"code": 0, "message": "Fulfillment dispute created", "data": serialize_fulfillment(fulfillment, session)}


def _validate_submission_media(
    session: Session,
    user: User,
    order: Order,
    media_urls: list[str],
) -> None:
    assets = list(session.scalars(select(MediaAsset).where(MediaAsset.owner_id == user.id, MediaAsset.url.in_(media_urls))))
    assets_by_url = {asset.url: asset for asset in assets}
    if len(media_urls) != len(set(media_urls)) or len(assets_by_url) != len(set(media_urls)):
        raise HTTPException(status_code=422, detail="All media must be uploaded by the current talent")
    image_count = sum(1 for asset in assets_by_url.values() if asset.content_type.startswith("image/"))
    if image_count < order.required_media_count:
        raise HTTPException(status_code=422, detail=f"At least {order.required_media_count} images are required")
    if not any(
        asset.content_type == "video/mp4"
        and asset.duration_seconds is not None
        and asset.duration_seconds > Decimal("5")
        for asset in assets_by_url.values()
    ):
        raise HTTPException(status_code=422, detail="At least one MP4 video longer than 5 seconds is required")


@router.post("/fulfillments/{fulfillment_id}/submissions", status_code=status.HTTP_201_CREATED)
def create_fulfillment_submission(
    fulfillment_id: int,
    payload: FulfillmentSubmissionRequest,
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    order = ensure_fulfillment_access(fulfillment, user, session)
    if fulfillment.model_id != user.id:
        raise HTTPException(status_code=403, detail="Only the assigned talent can submit media")
    if fulfillment.status not in {"IN_PROGRESS", "REVISION_REQUIRED"}:
        raise HTTPException(status_code=409, detail="Fulfillment is not ready for a new submission")
    _validate_submission_media(session, user, order, payload.submitted_media)
    latest_version = session.scalar(
        select(func.max(FulfillmentSubmission.version)).where(FulfillmentSubmission.fulfillment_id == fulfillment.id)
    ) or 0
    now = datetime.now(timezone.utc)
    submission = FulfillmentSubmission(
        fulfillment_id=fulfillment.id,
        version=latest_version + 1,
        status="PENDING_REVIEW",
        media_urls=json.dumps(payload.submitted_media),
        remark=(payload.remark or "").strip() or None,
        submitted_at=now,
    )
    session.add(submission)
    fulfillment.status = "SUBMITTED"
    fulfillment.submitted_at = now
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail="A newer submission was already created; refresh and try again") from exc
    session.refresh(submission)
    return {"code": 0, "message": "Submission created", "data": serialize_submission(submission)}


@router.put("/fulfillments/{fulfillment_id}/submissions/{submission_id}/review")
def review_fulfillment_submission(
    fulfillment_id: int,
    submission_id: int,
    payload: FulfillmentSubmissionReviewRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    fulfillment = get_fulfillment(session, fulfillment_id)
    order = ensure_fulfillment_access(fulfillment, user, session)
    if user.role != "admin" and (user.role != "merchant" or user.id != order.merchant_id):
        raise HTTPException(status_code=403, detail="Only the merchant or admin can review submissions")
    submission = session.scalar(
        select(FulfillmentSubmission).where(
            FulfillmentSubmission.id == submission_id,
            FulfillmentSubmission.fulfillment_id == fulfillment.id,
        )
    )
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission does not exist")
    if submission.status != "PENDING_REVIEW":
        raise HTTPException(status_code=409, detail="Submission has already been reviewed")
    if fulfillment.status != "SUBMITTED":
        raise HTTPException(status_code=409, detail="Fulfillment is not awaiting submission review")
    now = datetime.now(timezone.utc)
    submission.status = "APPROVED" if payload.approved else "REVISION_REQUIRED"
    submission.review_reason = (payload.reason or "").strip() or None
    submission.reviewer_id = user.id
    submission.reviewed_at = now
    fulfillment.reviewed_at = now
    try:
        if payload.approved:
            fulfillment.reject_reason = None
            if fulfillment.return_required:
                fulfillment.status = "WAITING_RETURN"
            else:
                fulfillment.status = "SUBMITTED"
                complete_fulfillment_and_settle(session, fulfillment, user.id)
        else:
            fulfillment.status = "REVISION_REQUIRED"
            fulfillment.reject_reason = submission.review_reason
        session.commit()
        session.refresh(fulfillment)
    except (WalletConflictError, IntegrityError) as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc) or "履约结算失败") from exc
    return {"code": 0, "message": "Submission review completed", "data": serialize_fulfillment(fulfillment, session)}


@router.get("/{order_id}")
def order_detail(order_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_workspace_access(order, user, session)
    data = serialize_order(order)
    merchant = session.get(User, order.merchant_id)
    data["merchant"] = None if merchant is None else {"id": merchant.id, "nickname": merchant.nickname, "phone": merchant.phone}
    application_model_id = user.id if user.role == "model" else order.model_id
    application = session.scalar(
        select(OrderApplication).where(
            OrderApplication.order_id == order.id,
            OrderApplication.model_id == application_model_id,
        )
    )
    if application is not None:
        data["owned_product_images"] = json.loads(application.owned_product_images or "[]")
        data["application_reason"] = application.review_reason
    applications_query = select(OrderApplication).where(OrderApplication.order_id == order.id)
    fulfillments_query = select(OrderFulfillment).where(OrderFulfillment.order_id == order.id)
    if user.role == "model":
        applications_query = applications_query.where(OrderApplication.model_id == user.id)
        fulfillments_query = fulfillments_query.where(OrderFulfillment.model_id == user.id)
    data["summary"] = fulfillment_summary(order, session)
    data["applications"] = [
        serialize_application(item, session)
        for item in session.scalars(applications_query.order_by(OrderApplication.created_at.asc()))
    ]
    data["fulfillments"] = [
        serialize_fulfillment(item, session)
        for item in session.scalars(fulfillments_query.order_by(OrderFulfillment.slot_no.asc()))
    ]
    logs = list(session.scalars(select(OrderLog).where(OrderLog.order_id == order.id).order_by(OrderLog.created_at.asc(), OrderLog.id.asc())))
    data["logs"] = [
        {
            "id": log.id,
            "operator_id": log.operator_id,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "remark": log.remark,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "operator": (
                None
                if (operator := session.get(User, log.operator_id)) is None
                else {"id": operator.id, "nickname": operator.nickname, "role": operator.role}
            ),
        }
        for log in logs
    ]
    return {"code": 0, "message": "ok", "data": data}


@router.put("/{order_id}/ship")
def ship_order(order_id: int, payload: ShipmentRequest, user: User = Depends(require_role("merchant")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "merchant")
    if order.product_source != "merchant_ship":
        raise HTTPException(status_code=409, detail="达人自购或已有同款订单无需寄样")
    return advance(
        session,
        order,
        "SHIPPED_TO_MODEL",
        user,
        "商家已寄出样品",
        {"ship_to_model_tracking_no": payload.tracking_no, "ship_to_model_company": payload.company},
    )


@router.put("/{order_id}/receive")
def receive_order(order_id: int, user: User = Depends(require_role("model")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "model")
    return advance(session, order, "IN_PROGRESS", user, "达人确认收货")


@router.put("/{order_id}/submit")
def submit_order(order_id: int, payload: SubmitOrderRequest, user: User = Depends(require_role("model")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "model")
    assets = list(
        session.scalars(
            select(MediaAsset).where(MediaAsset.owner_id == user.id, MediaAsset.url.in_(payload.submitted_media))
        )
    )
    assets_by_url = {asset.url: asset for asset in assets}
    if len(payload.submitted_media) != len(set(payload.submitted_media)) or len(assets_by_url) != len(set(payload.submitted_media)):
        raise HTTPException(status_code=422, detail="交付素材必须使用本人通过平台上传的文件")
    image_count = sum(1 for url in payload.submitted_media if assets_by_url[url].content_type.startswith("image/"))
    valid_videos = [
        asset
        for asset in assets_by_url.values()
        if asset.content_type == "video/mp4" and asset.duration_seconds is not None and asset.duration_seconds > 5
    ]
    if image_count < order.required_media_count:
        raise HTTPException(status_code=422, detail=f"交付素材至少需要 {order.required_media_count} 张图片")
    if not valid_videos:
        raise HTTPException(status_code=422, detail="交付素材必须包含至少 1 个时长大于 5 秒的 MP4 视频")
    changes: dict[str, object] = {"submitted_media": json.dumps(payload.submitted_media)}
    if order.return_required:
        if not payload.tracking_no or not payload.company:
            raise HTTPException(status_code=422, detail="需要返货时必须填写物流公司和物流单号")
        changes.update({"return_tracking_no": payload.tracking_no, "return_company": payload.company})
    return advance(
        session,
        order,
        "RETURNED",
        user,
        "达人已提交素材并寄回" if order.return_required else "达人已提交素材，商品归达人自留",
        changes,
    )


@router.put("/{order_id}/owned-product-review")
def review_owned_product(
    order_id: int,
    payload: OwnedProductReviewRequest,
    user: User = Depends(require_role("merchant")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "merchant")
    if order.product_source != "talent_owned" or order.status != "CLAIMED":
        raise HTTPException(status_code=409, detail="当前订单无需进行同款商品审核")
    application = session.scalar(
        select(OrderApplication).where(OrderApplication.order_id == order.id, OrderApplication.model_id == order.model_id)
    )
    if application is None:
        raise HTTPException(status_code=409, detail="未找到该达人的接单申请")
    if not payload.approved:
        application.status = "REJECTED"
        application.review_reason = payload.reason.strip() if payload.reason else None
        return advance(
            session,
            order,
            "PUBLISHED",
            user,
            "商家驳回达人同款商品，订单重新开放申请",
            {"model_id": None},
        )
    return advance(session, order, "IN_PROGRESS", user, "商家已审核通过达人同款商品")


@router.put("/{order_id}/accept")
def accept_order(order_id: int, user: User = Depends(require_role("merchant")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "merchant")
    try:
        complete_order_and_settle(session, order, user.id)
        session.commit()
        session.refresh(order)
    except (OrderConflictError, WalletConflictError, IntegrityError) as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc) or "订单结算失败") from exc
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.put("/{order_id}/reject")
def reject_order(order_id: int, payload: RejectOrderRequest, user: User = Depends(require_role("merchant")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "merchant")
    return advance(session, order, "DISPUTED", user, "商家发起争议", {"reject_reason": payload.reason})


@router.put("/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(require_role("merchant")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_legacy_single_order(order)
    ensure_order_owner(order, user, "merchant")
    return advance(session, order, "CANCELLED", user, "商家撤回订单")


@router.post("/{order_id}/messages", status_code=status.HTTP_201_CREATED)
def create_message(order_id: int, payload: OrderMessageRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_member(order, user)
    message = OrderMessage(order_id=order.id, fulfillment_id=None, sender_id=user.id, content=payload.content)
    session.add(message)
    session.commit()
    session.refresh(message)
    return {"code": 0, "message": "ok", "data": {"id": message.id, "content": message.content, "sender_id": message.sender_id}}


@router.get("/{order_id}/messages")
def list_messages(order_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_member(order, user)
    messages = list(
        session.scalars(
            select(OrderMessage)
            .where(OrderMessage.order_id == order_id, OrderMessage.fulfillment_id.is_(None))
            .order_by(OrderMessage.created_at.asc())
        )
    )
    return {"code": 0, "message": "ok", "data": {"items": [{"id": item.id, "sender_id": item.sender_id, "content": item.content, "created_at": item.created_at.isoformat() if item.created_at else None} for item in messages], "total": len(messages)}}
