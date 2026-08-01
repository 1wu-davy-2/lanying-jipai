from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.models.order import Order, OrderApplication, OrderFulfillment, OrderLog
from app.models.user import User
from app.services.talent_level import claim_block_reason

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "DRAFT": {"PUBLISHED"},
    "PUBLISHED": {"CLAIMED", "OWNED_PRODUCT_REVIEW", "IN_PROGRESS", "CANCELLED"},
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
        raise OrderConflictError("Order status changed; please retry")
    session.add(
        OrderLog(
            order_id=order.id,
            operator_id=operator_id,
            from_status=previous_status,
            to_status=target_status,
            remark=remark,
        )
    )


def claim_order(session: Session, order_id: int, model_id: int) -> None:
    """Legacy single-order claim helper retained for compatibility."""
    now = datetime.now(timezone.utc)
    result = session.execute(
        update(Order)
        .where(Order.id == order_id, Order.status == "PUBLISHED")
        .values(status="CLAIMED", model_id=model_id, claimed_at=now, updated_at=now)
    )
    if result.rowcount != 1:
        session.rollback()
        raise OrderConflictError("Order is already assigned or unavailable")
    session.add(
        OrderLog(
            order_id=order_id,
            operator_id=model_id,
            from_status="PUBLISHED",
            to_status="CLAIMED",
            remark="Talent claimed order",
        )
    )
    session.commit()


def approve_order_application(session: Session, application: OrderApplication, reviewer_id: int) -> OrderFulfillment:
    """Approve one application and allocate one independent parent-order slot."""
    if application.status != "PENDING":
        raise OrderConflictError("该申请已处理")

    # Lock the parent row so two concurrent reviewers cannot allocate the same slot.
    order = session.scalar(select(Order).where(Order.id == application.order_id).with_for_update())
    if order is None or order.status != "PUBLISHED":
        raise OrderConflictError("订单已分配或不可审核")
    applicant = session.get(User, application.model_id)
    if applicant is None:
        raise OrderConflictError("申请达人不存在")
    reason = claim_block_reason(session, applicant, order.commission_amount)
    if reason:
        raise OrderConflictError(reason)

    # A cancelled fulfillment remains as audit history but releases its slot.
    session.execute(
        update(OrderFulfillment)
        .where(
            OrderFulfillment.order_id == order.id,
            OrderFulfillment.status == "CANCELLED",
            OrderFulfillment.slot_no.is_not(None),
        )
        .values(slot_no=None)
    )
    allocated_count = session.scalar(
        select(func.count()).select_from(OrderFulfillment).where(
            OrderFulfillment.order_id == order.id,
            OrderFulfillment.status != "CANCELLED",
        )
    ) or 0
    if allocated_count >= order.quantity:
        raise OrderConflictError("All order slots have been allocated")
    existing_fulfillment = session.scalar(
        select(OrderFulfillment).where(
            OrderFulfillment.order_id == order.id,
            OrderFulfillment.model_id == application.model_id,
        )
    )
    if existing_fulfillment is not None and existing_fulfillment.status != "CANCELLED":
        raise OrderConflictError("Applicant already owns a slot for this order")
    occupied_slots = set(
        session.scalars(
            select(OrderFulfillment.slot_no).where(
                OrderFulfillment.order_id == order.id,
                OrderFulfillment.status != "CANCELLED",
                OrderFulfillment.slot_no.is_not(None),
            )
        )
    )
    slot_no = next((candidate for candidate in range(1, order.quantity + 1) if candidate not in occupied_slots), None)
    if slot_no is None:
        raise OrderConflictError("All order slots have been allocated")

    now = datetime.now(timezone.utc)
    assigned_status = (
        "IN_PROGRESS"
        if order.product_source == "talent_purchase"
        else "OWNED_PRODUCT_REVIEW"
        if order.product_source == "talent_owned"
        else "CLAIMED"
    )
    try:
        fulfillment = existing_fulfillment or OrderFulfillment()
        if existing_fulfillment is None:
            session.add(fulfillment)
        fulfillment.order_id = order.id
        fulfillment.application_id = application.id
        fulfillment.model_id = application.model_id
        fulfillment.slot_no = slot_no
        fulfillment.status = assigned_status
        fulfillment.product_source = order.product_source
        fulfillment.return_required = order.return_required
        fulfillment.self_keep_after_shoot = order.self_keep_after_shoot
        fulfillment.commission_amount = order.commission_amount
        fulfillment.product_subsidy_amount = order.product_subsidy_amount
        fulfillment.claimed_at = now
        fulfillment.in_progress_at = now if assigned_status == "IN_PROGRESS" else None
        fulfillment.reject_reason = None
        result = session.execute(
            update(OrderApplication)
            .where(OrderApplication.id == application.id, OrderApplication.status == "PENDING")
            .values(
                status="APPROVED",
                reviewer_id=reviewer_id,
                reviewed_at=now,
                review_reason="Application approved",
            )
        )
        if result.rowcount != 1:
            raise OrderConflictError("该申请已处理")

        # Keep a first-talent projection for old clients. The parent remains open
        # until the last slot is allocated, so other applicants remain reviewable.
        if order.model_id is None:
            order.model_id = application.model_id
        parent_filled = allocated_count + 1 >= order.quantity
        if parent_filled:
            order.status = assigned_status
            order.claimed_at = now
            if assigned_status == "IN_PROGRESS":
                order.in_progress_at = now
        session.add(
            OrderLog(
                order_id=order.id,
                operator_id=reviewer_id,
                from_status="PUBLISHED",
                to_status=assigned_status if parent_filled else "FULFILLMENT_CREATED",
                remark="Application approved and fulfillment slot allocated",
            )
        )
        session.flush()
        return fulfillment
    except (IntegrityError, OperationalError) as exc:
        session.rollback()
        raise OrderConflictError("Slot allocation conflicted; please retry") from exc
