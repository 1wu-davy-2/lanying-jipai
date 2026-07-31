import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.media import MediaAsset
from app.models.order import Order, OrderApplication, OrderLog, OrderMessage
from app.models.user import User
from app.product_categories import PRODUCT_CATEGORIES
from app.schemas.order import (
    OrderCreateRequest,
    OrderApplicationRequest,
    OrderMessageRequest,
    OwnedProductReviewRequest,
    RejectOrderRequest,
    ShipmentRequest,
    SubmitOrderRequest,
)
from app.services.order_service import OrderConflictError, transition_order
from app.services.talent_level import claim_block_reason
from app.services.wallet_service import WalletConflictError, complete_order_and_settle
from app.utils.order_no import new_order_no

router = APIRouter(prefix="/orders", tags=["orders"])


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
    statement = select(Order).where(Order.merchant_id == user.id if user.role == "merchant" else Order.model_id == user.id)
    if status_filter:
        statement = statement.where(Order.status == status_filter)
    total = session.scalar(select(func.count()).select_from(statement.subquery())) or 0
    orders = list(session.scalars(statement.order_by(Order.created_at.desc()).offset((page - 1) * page_size).limit(page_size)))
    return {"code": 0, "message": "ok", "data": {"items": [serialize_order(order) for order in orders], "total": total, "page": page, "page_size": page_size}}


@router.get("/{order_id}")
def order_detail(order_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_member(order, user)
    data = serialize_order(order)
    merchant = session.get(User, order.merchant_id)
    data["merchant"] = None if merchant is None else {"id": merchant.id, "nickname": merchant.nickname, "phone": merchant.phone}
    application = session.scalar(
        select(OrderApplication).where(OrderApplication.order_id == order.id, OrderApplication.model_id == order.model_id)
    )
    if application is not None:
        data["owned_product_images"] = json.loads(application.owned_product_images or "[]")
        data["application_reason"] = application.review_reason
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
    ensure_order_owner(order, user, "model")
    return advance(session, order, "IN_PROGRESS", user, "达人确认收货")


@router.put("/{order_id}/submit")
def submit_order(order_id: int, payload: SubmitOrderRequest, user: User = Depends(require_role("model")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
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
    ensure_order_owner(order, user, "merchant")
    return advance(session, order, "DISPUTED", user, "商家发起争议", {"reject_reason": payload.reason})


@router.put("/{order_id}/cancel")
def cancel_order(order_id: int, user: User = Depends(require_role("merchant")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_owner(order, user, "merchant")
    return advance(session, order, "CANCELLED", user, "商家撤回订单")


@router.post("/{order_id}/messages", status_code=status.HTTP_201_CREATED)
def create_message(order_id: int, payload: OrderMessageRequest, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_member(order, user)
    message = OrderMessage(order_id=order.id, sender_id=user.id, content=payload.content)
    session.add(message)
    session.commit()
    session.refresh(message)
    return {"code": 0, "message": "ok", "data": {"id": message.id, "content": message.content, "sender_id": message.sender_id}}


@router.get("/{order_id}/messages")
def list_messages(order_id: int, user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_member(order, user)
    messages = list(session.scalars(select(OrderMessage).where(OrderMessage.order_id == order_id).order_by(OrderMessage.created_at.asc())))
    return {"code": 0, "message": "ok", "data": {"items": [{"id": item.id, "sender_id": item.sender_id, "content": item.content, "created_at": item.created_at.isoformat() if item.created_at else None} for item in messages], "total": len(messages)}}
