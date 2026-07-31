from datetime import datetime, timezone
from typing import Any

from sqlalchemy import update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models.order import Order, OrderApplication, OrderLog
from app.models.user import User
from app.services.talent_level import claim_block_reason

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"PUBLISHED"},
    "PUBLISHED": {"CLAIMED", "OWNED_PRODUCT_REVIEW", "CANCELLED"},
    "CLAIMED": {"SHIPPED_TO_MODEL"},
    "OWNED_PRODUCT_REVIEW": {"IN_PROGRESS", "PUBLISHED"},
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


def approve_order_application(session: Session, application: OrderApplication, reviewer_id: int) -> None:
    """Assign a published order exactly once while accepting the selected application."""
    if application.status != "PENDING":
        raise OrderConflictError("该申请已处理")
    order = session.get(Order, application.order_id)
    if order is None or order.status != "PUBLISHED":
        raise OrderConflictError("订单已分配或不可审核")
    applicant = session.get(User, application.model_id)
    if applicant is None:
        raise OrderConflictError("申请达人不存在")
    reason = claim_block_reason(session, applicant, order.commission_amount)
    if reason:
        raise OrderConflictError(reason)

    now = datetime.now(timezone.utc)
    assigned_status = (
        "IN_PROGRESS"
        if order.product_source == "talent_purchase"
        else "OWNED_PRODUCT_REVIEW"
        if order.product_source == "talent_owned"
        else "CLAIMED"
    )
    try:
        result = session.execute(
            update(Order)
            .where(Order.id == order.id, Order.status == "PUBLISHED")
            .values(
                status=assigned_status,
                model_id=application.model_id,
                claimed_at=now,
                in_progress_at=now if assigned_status == "IN_PROGRESS" else None,
                updated_at=now,
            )
        )
        if result.rowcount != 1:
            raise OrderConflictError("订单已分配或不可审核")
        application_result = session.execute(
            update(OrderApplication)
            .where(OrderApplication.id == application.id, OrderApplication.status == "PENDING")
            .values(status="APPROVED", reviewer_id=reviewer_id, reviewed_at=now, review_reason="运营审核通过")
        )
        if application_result.rowcount != 1:
            raise OrderConflictError("该申请已处理")
        session.execute(
            update(OrderApplication)
            .where(OrderApplication.order_id == order.id, OrderApplication.id != application.id, OrderApplication.status == "PENDING")
            .values(status="REJECTED", reviewer_id=reviewer_id, reviewed_at=now, review_reason="订单已分配给其他达人")
        )
        session.add(
            OrderLog(
                order_id=order.id,
                operator_id=reviewer_id,
                from_status="PUBLISHED",
                to_status=assigned_status,
                remark=(
                    "运营审核通过达人申请，达人自行购买商品后拍摄"
                    if assigned_status == "IN_PROGRESS"
                    else "运营审核通过达人申请，等待商家审核同款商品"
                    if assigned_status == "OWNED_PRODUCT_REVIEW"
                    else "运营审核通过达人申请并分配订单"
                ),
            )
        )
        session.expire(order)
        session.expire(application)
    except OperationalError as exc:
        session.rollback()
        raise OrderConflictError("订单已分配或不可审核") from exc
