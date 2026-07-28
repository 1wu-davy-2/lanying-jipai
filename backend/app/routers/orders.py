import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.order import Order, OrderLog, OrderMessage
from app.models.user import User
from app.schemas.order import (
    OrderCreateRequest,
    OrderMessageRequest,
    RejectOrderRequest,
    ShipmentRequest,
    SubmitOrderRequest,
)
from app.services.order_service import OrderConflictError, claim_order, transition_order
from app.services.wallet_service import WalletConflictError, complete_order_and_settle
from app.utils.order_no import new_order_no

router = APIRouter(prefix="/orders", tags=["orders"])


def serialize_order(order: Order) -> dict[str, object]:
    return {
        "id": order.id,
        "order_no": order.order_no,
        "merchant_id": order.merchant_id,
        "model_id": order.model_id,
        "title": order.title,
        "description": order.description,
        "sample_images": json.loads(order.sample_images or "[]"),
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


@router.post("", status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreateRequest,
    user: User = Depends(require_role("merchant")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    order = Order(
        order_no=new_order_no(),
        merchant_id=user.id,
        title=payload.title,
        description=payload.description,
        sample_images=json.dumps(payload.sample_images),
        commission_amount=payload.commission_amount,
        deposit_amount=payload.deposit_amount,
        shoot_requirements=payload.shoot_requirements,
        status="PUBLISHED",
    )
    session.add(order)
    session.commit()
    session.refresh(order)
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


@router.get("/hall")
def order_hall(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(Order).where(Order.status == "PUBLISHED").order_by(Order.created_at.desc())
    orders = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    total = session.scalar(select(func.count()).select_from(Order).where(Order.status == "PUBLISHED")) or 0
    return {"code": 0, "message": "ok", "data": {"items": [serialize_order(order) for order in orders], "total": total, "page": page, "page_size": page_size}}


@router.post("/{order_id}/claim")
def claim(order_id: int, user: User = Depends(require_role("model")), session: Session = Depends(get_db)) -> dict[str, object]:
    try:
        claim_order(session, order_id, user.id)
    except OrderConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    order = get_order(session, order_id)
    return {"code": 0, "message": "ok", "data": serialize_order(order)}


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
    logs = list(session.scalars(select(OrderLog).where(OrderLog.order_id == order.id).order_by(OrderLog.created_at.asc(), OrderLog.id.asc())))
    data["logs"] = [
        {
            "id": log.id,
            "operator_id": log.operator_id,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "remark": log.remark,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
    return {"code": 0, "message": "ok", "data": data}


@router.put("/{order_id}/ship")
def ship_order(order_id: int, payload: ShipmentRequest, user: User = Depends(require_role("merchant")), session: Session = Depends(get_db)) -> dict[str, object]:
    order = get_order(session, order_id)
    ensure_order_owner(order, user, "merchant")
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
    return advance(
        session,
        order,
        "RETURNED",
        user,
        "达人已提交素材并寄回",
        {
            "submitted_media": json.dumps(payload.submitted_media),
            "return_tracking_no": payload.tracking_no,
            "return_company": payload.company,
        },
    )


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
