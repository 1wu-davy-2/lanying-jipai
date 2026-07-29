from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.user import User


@dataclass(frozen=True)
class TalentLevel:
    code: str
    name: str
    min_completed_orders: int
    max_active_orders: int
    max_commission_amount: Decimal


TALENT_LEVELS = (
    TalentLevel("L1", "新星达人", 0, 1, Decimal("300")),
    TalentLevel("L2", "稳定达人", 5, 2, Decimal("800")),
    TalentLevel("L3", "进阶达人", 20, 3, Decimal("1500")),
    TalentLevel("L4", "资深达人", 50, 5, Decimal("3000")),
    TalentLevel("L5", "星耀达人", 120, 8, Decimal("8000")),
)

ACTIVE_ORDER_STATUSES = ("CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED")


def parse_portfolio_urls(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        urls = json.loads(value)
    except json.JSONDecodeError:
        return []
    return [url for url in urls if isinstance(url, str) and url]


def completed_order_count(session: Session, user_id: int) -> int:
    return session.scalar(
        select(func.count()).select_from(Order).where(Order.model_id == user_id, Order.status == "COMPLETED")
    ) or 0


def active_order_count(session: Session, user_id: int) -> int:
    return session.scalar(
        select(func.count())
        .select_from(Order)
        .where(Order.model_id == user_id, Order.status.in_(ACTIVE_ORDER_STATUSES))
    ) or 0


def talent_level_for_completed_orders(completed_orders: int) -> TalentLevel:
    return next(level for level in reversed(TALENT_LEVELS) if completed_orders >= level.min_completed_orders)


def talent_status(session: Session, user: User) -> dict[str, object]:
    completed_orders = completed_order_count(session, user.id)
    active_orders = active_order_count(session, user.id)
    level = talent_level_for_completed_orders(completed_orders)
    profile = user.model_profile
    profile_complete = bool(
        user.avatar_url
        and user.nickname
        and user.nickname != user.phone[-4:]
        and profile
        and profile.receive_address
        and profile.receiver_name
        and profile.receiver_phone
        and profile.receive_address_detail
        and len(parse_portfolio_urls(profile.portfolio_urls)) >= 6
    )
    verified = user.verify_status == "verified"
    return {
        "profile_complete": profile_complete,
        "verified": verified,
        "can_claim": profile_complete and verified,
        "completed_orders": completed_orders,
        "active_orders": active_orders,
        "level": {
            "code": level.code,
            "name": level.name,
            "max_active_orders": level.max_active_orders,
            "max_commission_amount": str(level.max_commission_amount),
            "next_level_completed_orders": next(
                (item.min_completed_orders for item in TALENT_LEVELS if item.min_completed_orders > completed_orders),
                None,
            ),
        },
    }


def claim_block_reason(session: Session, user: User, commission_amount: Decimal) -> str | None:
    status = talent_status(session, user)
    if not status["profile_complete"]:
        return "请先完成头像、用户名、收货地区和至少 6 张作品照片"
    if not status["verified"]:
        return "实名认证审核通过后才可正式接单"
    level = talent_level_for_completed_orders(status["completed_orders"])
    if status["active_orders"] >= level.max_active_orders:
        return f"{level.name}同时最多可接 {level.max_active_orders} 单"
    if commission_amount > level.max_commission_amount:
        return f"{level.name}单笔佣金上限为 ¥{level.max_commission_amount}"
    return None
