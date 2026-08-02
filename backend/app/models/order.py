from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, ID_TYPE
from app.models.user import TimestampMixin


class Order(TimestampMixin, Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    order_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    merchant_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), index=True, nullable=False)
    model_id: Mapped[Optional[int]] = mapped_column(ID_TYPE, ForeignKey("users.id"), index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    product_categories: Mapped[str] = mapped_column(String(255), nullable=False, default='["其他"]')
    sample_images: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_type: Mapped[str] = mapped_column(String(30), nullable=False, default="product_photo")
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    required_media_count: Mapped[int] = mapped_column(Integer, nullable=False, default=6)
    delivery_days: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    deposit_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    return_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    product_source: Mapped[str] = mapped_column(String(30), nullable=False, default="merchant_ship")
    product_subsidy_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    self_keep_after_shoot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    deposit_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    shoot_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), index=True, nullable=False, default="PUBLISHED")
    ship_to_model_tracking_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ship_to_model_company: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    return_tracking_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    return_company: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    submitted_media: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    shipped_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    in_progress_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    returned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class OrderLog(Base):
    __tablename__ = "order_logs"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("orders.id"), index=True, nullable=False)
    operator_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), nullable=False)
    from_status: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    to_status: Mapped[str] = mapped_column(String(30), nullable=False)
    remark: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class OrderMessage(Base):
    __tablename__ = "order_messages"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("orders.id"), index=True, nullable=False)
    # Legacy parent-order messages keep this field NULL.  New multi-talent
    # conversations are isolated to one fulfillment instance.
    fulfillment_id: Mapped[Optional[int]] = mapped_column(
        ID_TYPE,
        ForeignKey("order_fulfillments.id"),
        index=True,
        nullable=True,
    )
    sender_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class OrderFulfillment(TimestampMixin, Base):
    """One talent's independent slot under a parent order."""

    __tablename__ = "order_fulfillments"
    __table_args__ = (
        UniqueConstraint("order_id", "model_id", name="uq_order_fulfillment_model"),
        UniqueConstraint("order_id", "slot_no", name="uq_order_fulfillment_slot"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("orders.id"), index=True, nullable=False)
    application_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("order_applications.id"), unique=True, nullable=False)
    model_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), index=True, nullable=False)
    slot_no: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(30), index=True, nullable=False, default="CLAIMED")
    product_source: Mapped[str] = mapped_column(String(30), nullable=False, default="merchant_ship")
    return_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    self_keep_after_shoot: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    product_subsidy_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    ship_to_model_tracking_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ship_to_model_company: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    return_tracking_no: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    return_company: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    shipped_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    in_progress_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    returned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class FulfillmentSubmission(TimestampMixin, Base):
    """Versioned media submission for a single fulfillment."""

    __tablename__ = "fulfillment_submissions"
    __table_args__ = (UniqueConstraint("fulfillment_id", "version", name="uq_fulfillment_submission_version"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    fulfillment_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("order_fulfillments.id"), index=True, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), index=True, nullable=False, default="PENDING_REVIEW")
    media_urls: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewer_id: Mapped[Optional[int]] = mapped_column(ID_TYPE, ForeignKey("users.id"), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class OrderApplication(TimestampMixin, Base):
    __tablename__ = "order_applications"
    __table_args__ = (UniqueConstraint("order_id", "model_id", name="uq_order_application_model"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    order_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("orders.id"), index=True, nullable=False)
    model_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), index=True, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    owned_product_images: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), index=True, nullable=False, default="PENDING")
    reviewer_id: Mapped[Optional[int]] = mapped_column(ID_TYPE, ForeignKey("users.id"), nullable=True)
    review_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
