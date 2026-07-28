from datetime import datetime, timezone
from typing import Any

from sqlalchemy import update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models.order import Order, OrderLog

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"PUBLISHED"},
    "PUBLISHED": {"CLAIMED", "CANCELLED"},
    "CLAIMED": {"SHIPPED_TO_MODEL"},
    "SHIPPED_TO_MODEL": {"IN_PROGRESS"},
    "IN_PROGRESS": {"RETURNED"},
    "RETURNED": {"COMPLETED", "DISPUTED"},
    "DISPUTED": {"COMPLETED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}

_STATUS_TIMESTAMP_FIELDS = {
    "CLAIMED": "claimed_at",
    "SHIPPED_TO_MODEL": "shipped_at",
    "IN_PROGRESS": "in_progress_at",
    "RETURNED": "returned_at",
    "COMPLETED": "completed_at",
    "CANCELLED": "cancelled_at",
}


class OrderConflictError(Exception):
    pass


def transition_order(
    session: Session,
    order: Order,
    target_status: str,
    operator_id: int,
    remark: str | None = None,
    changes: dict[str, Any] | None = None,
) -> None:
    if target_status not in ALLOWED_TRANSITIONS.get(order.status, set()):
        raise OrderConflictError("订单当前状态不允许该操作")
    previous_status = order.status
    now = datetime.now(timezone.utc)
    values: dict[str, Any] = {"status": target_status, "updated_at": now}
    timestamp_field = _STATUS_TIMESTAMP_FIELDS.get(target_status)
    if timestamp_field:
        values[timestamp_field] = now
    if changes:
        values.update(changes)
    try:
        result = session.execute(
            update(Order).where(Order.id == order.id, Order.status == previous_status).values(**values)
        )
    except OperationalError as exc:
        session.rollback()
        raise OrderConflictError("订单当前状态不允许该操作") from exc
    if result.rowcount != 1:
        raise OrderConflictError("订单当前状态不允许该操作")
    session.add(OrderLog(order_id=order.id, operator_id=operator_id, from_status=previous_status, to_status=target_status, remark=remark))


def claim_order(session: Session, order_id: int, model_id: int) -> None:
    now = datetime.now(timezone.utc)
    try:
        result = session.execute(
            update(Order)
            .where(Order.id == order_id, Order.status == "PUBLISHED")
            .values(status="CLAIMED", model_id=model_id, claimed_at=now, updated_at=now)
        )
        if result.rowcount != 1:
            session.rollback()
            raise OrderConflictError("该订单已被抢走或不可抢")
        session.add(OrderLog(order_id=order_id, operator_id=model_id, from_status="PUBLISHED", to_status="CLAIMED", remark="达人抢单"))
        session.commit()
    except OperationalError as exc:
        session.rollback()
        raise OrderConflictError("该订单已被抢走或不可抢") from exc
