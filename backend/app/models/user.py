from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, ID_TYPE

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    real_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    id_card_no: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    alipay_account: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    alipay_real_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    verify_status: Mapped[str] = mapped_column(String(20), default="unverified", nullable=False)
    verify_reject_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    merchant_profile: Mapped[Optional[MerchantProfile]] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    model_profile: Mapped[Optional[ModelProfile]] = relationship(
        back_populates="user", cascade="all, delete-orphan", uselist=False
    )


class MerchantProfile(TimestampMixin, Base):
    __tablename__ = "merchant_profiles"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), unique=True, nullable=False)
    shop_name: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    shop_platform: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    contact_phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    default_ship_address: Mapped[str] = mapped_column(String(255), default="", nullable=False)

    user: Mapped[User] = relationship(back_populates="merchant_profile")


class ModelProfile(TimestampMixin, Base):
    __tablename__ = "model_profiles"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("users.id"), unique=True, nullable=False)
    height_cm: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    weight_kg: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    shoe_size: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    skill_tags: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    receive_address: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    portfolio_urls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="model_profile")
