from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, ID_TYPE
from app.models.user import TimestampMixin


class Wallet(TimestampMixin, Base):
    __tablename__ = "wallets"
    __table_args__ = (
        CheckConstraint("available_balance >= 0", name="ck_wallets_available_nonnegative"),
        CheckConstraint("frozen_balance >= 0", name="ck_wallets_frozen_nonnegative"),
    )

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), unique=True, nullable=False)
    available_balance: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    frozen_balance: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))


class Withdrawal(TimestampMixin, Base):
    __tablename__ = "withdrawals"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    withdrawal_no: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    alipay_account: Mapped[str] = mapped_column(String(255), nullable=False)
    alipay_real_name: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), index=True, nullable=False, default="pending")
    reviewer_id: Mapped[Optional[int]] = mapped_column(ID_TYPE, ForeignKey("users.id"), nullable=True)
    reject_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    transfer_no: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    transferred_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    remark: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    idempotency_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), index=True, nullable=False)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    frozen_balance_after: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    order_id: Mapped[Optional[int]] = mapped_column(ID_TYPE, ForeignKey("orders.id"), nullable=True)
    withdrawal_id: Mapped[Optional[int]] = mapped_column(ID_TYPE, ForeignKey("withdrawals.id"), nullable=True)
    remark: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)


class PlatformConfig(TimestampMixin, Base):
    __tablename__ = "platform_configs"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    config_value: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
