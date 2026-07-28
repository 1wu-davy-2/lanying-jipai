from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, func
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
    sample_images: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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
    sender_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
