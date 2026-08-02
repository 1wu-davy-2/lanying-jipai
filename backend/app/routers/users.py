import json
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.order import Order, OrderFulfillment
from app.models.user import MerchantProfile, ModelProfile, User
from app.schemas.user import (
    AdminMerchantCreateRequest,
    MerchantProfileRequest,
    MerchantAssuranceRequest,
    ModelProfileRequest,
    UserUpdateRequest,
    VerifyRequest,
    VerifyReviewRequest,
    UserStatusUpdateRequest,
)
from app.security import decrypt_sensitive, encrypt_sensitive, hash_password, mask_id_card
from app.services.talent_level import TALENT_LEVELS, parse_portfolio_urls, talent_level_for_completed_orders, talent_status

router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin/users", tags=["admin users"])


def serialize_user(user: User, include_payment_details: bool = True) -> dict[str, object]:
    data: dict[str, object] = {
        "id": user.id,
        "phone": user.phone,
        "role": user.role,
        "nickname": user.nickname,
        "registration_channel": user.registration_channel,
        "avatar_url": user.avatar_url,
        "status": user.status,
        "real_name": user.real_name,
        "id_card_no": mask_id_card(decrypt_sensitive(user.id_card_no) if user.id_card_no else None),
        "alipay_account": user.alipay_account if include_payment_details else None,
        "alipay_real_name": user.alipay_real_name if include_payment_details else None,
        "verify_status": user.verify_status,
        "verify_reject_reason": user.verify_reject_reason,
        "merchant_profile": None,
        "model_profile": None,
    }
    if user.merchant_profile:
        data["merchant_profile"] = {
            "shop_name": user.merchant_profile.shop_name,
            "shop_platform": user.merchant_profile.shop_platform,
            "contact_phone": user.merchant_profile.contact_phone,
            "default_ship_address": user.merchant_profile.default_ship_address,
            "quality_merchant": user.merchant_profile.quality_merchant,
            "guarantee_deposit_paid": user.merchant_profile.guarantee_deposit_paid,
            "guarantee_deposit_amount": str(user.merchant_profile.guarantee_deposit_amount),
        }
    if user.model_profile:
        data["model_profile"] = {
            "height_cm": user.model_profile.height_cm,
            "weight_kg": user.model_profile.weight_kg,
            "shoe_size": user.model_profile.shoe_size,
            "skill_tags": user.model_profile.skill_tags,
            "receive_address": user.model_profile.receive_address,
            "receiver_name": user.model_profile.receiver_name,
            "receiver_phone": user.model_profile.receiver_phone,
            "receive_address_detail": user.model_profile.receive_address_detail,
            "portfolio_urls": parse_portfolio_urls(user.model_profile.portfolio_urls),
        }
    return data


@router.get("/me")
def read_me(current_user: User = Depends(get_current_user)) -> dict[str, object]:
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


@router.get("/me/talent-status")
def read_talent_status(
    current_user: User = Depends(require_role("model")), session: Session = Depends(get_db)
) -> dict[str, object]:
    return {"code": 0, "message": "ok", "data": talent_status(session, current_user)}


@router.get("/model-ranking")
def model_ranking(
    _: User = Depends(require_role("model")), session: Session = Depends(get_db)
) -> dict[str, object]:
    # Multi-talent orders settle per fulfillment.  Keep legacy parent-order
    # rows only when no fulfillment exists, so migrated history is not counted
    # twice while every assigned talent receives its own completed count.
    fulfillment_stats = (
        select(
            OrderFulfillment.model_id.label("model_id"),
            func.count(OrderFulfillment.id).label("completed_orders"),
            func.coalesce(func.sum(OrderFulfillment.commission_amount), Decimal("0")).label("earnings"),
        )
        .join(Order, Order.id == OrderFulfillment.order_id)
        .where(OrderFulfillment.status == "COMPLETED")
        .group_by(OrderFulfillment.model_id)
    )
    legacy_stats = (
        select(
            Order.model_id.label("model_id"),
            func.count(Order.id).label("completed_orders"),
            func.coalesce(func.sum(Order.commission_amount), Decimal("0")).label("earnings"),
        )
        .where(
            Order.status == "COMPLETED",
            Order.model_id.is_not(None),
            ~select(OrderFulfillment.id).where(OrderFulfillment.order_id == Order.id).exists(),
        )
        .group_by(Order.model_id)
    )
    stats_union = fulfillment_stats.union_all(legacy_stats).subquery()
    stats = (
        select(
            stats_union.c.model_id,
            func.sum(stats_union.c.completed_orders).label("completed_orders"),
            func.sum(stats_union.c.earnings).label("earnings"),
        )
        .group_by(stats_union.c.model_id)
        .subquery()
    )
    rows = session.execute(
        select(User, func.coalesce(stats.c.completed_orders, 0), func.coalesce(stats.c.earnings, Decimal("0")))
        .outerjoin(stats, stats.c.model_id == User.id)
        .where(User.role == "model", User.verify_status == "verified")
        .order_by(stats.c.completed_orders.desc(), stats.c.earnings.desc(), User.id.asc())
        .limit(20)
    ).all()
    real = [
        {
            "rank": index,
            "nickname": user.nickname,
            "avatar_url": user.avatar_url,
            "level": talent_level_for_completed_orders(int(completed_orders)).name,
            "completed_orders": int(completed_orders),
            "earnings": str(earnings_amount),
            "is_simulated": False,
        }
        for index, (user, completed_orders, earnings_amount) in enumerate(rows, start=1)
    ]
    simulated = [
        {"rank": 1, "nickname": "星野", "level": TALENT_LEVELS[4].name, "completed_orders": 286, "earnings": "186420.00", "is_simulated": True},
        {"rank": 2, "nickname": "林汐", "level": TALENT_LEVELS[3].name, "completed_orders": 94, "earnings": "78200.00", "is_simulated": True},
        {"rank": 3, "nickname": "苏棠", "level": TALENT_LEVELS[3].name, "completed_orders": 71, "earnings": "54680.00", "is_simulated": True},
    ]
    return {"code": 0, "message": "ok", "data": {"simulated": simulated, "real": real}}


@router.put("/me")
def update_me(payload: UserUpdateRequest, current_user: User = Depends(get_current_user), session: Session = Depends(get_db)) -> dict[str, object]:
    for name, value in payload.model_dump(exclude_unset=True).items():
        setattr(current_user, name, value)
    session.commit()
    session.refresh(current_user)
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


@router.put("/me/merchant-profile")
def update_merchant_profile(
    payload: MerchantProfileRequest,
    current_user: User = Depends(require_role("merchant")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    profile = current_user.merchant_profile
    if profile is None:
        profile = MerchantProfile(user=current_user)
        session.add(profile)
    for name, value in payload.model_dump().items():
        setattr(profile, name, value)
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


@router.put("/me/model-profile")
def update_model_profile(
    payload: ModelProfileRequest,
    current_user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    profile = current_user.model_profile
    if profile is None:
        profile = ModelProfile(user=current_user)
        session.add(profile)
    values = payload.model_dump()
    values["portfolio_urls"] = json.dumps(values["portfolio_urls"])
    for name, value in values.items():
        setattr(profile, name, value)
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


@router.post("/me/verify")
def submit_verification(
    payload: VerifyRequest,
    current_user: User = Depends(require_role("merchant", "model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    if current_user.role == "model" and not talent_status(session, current_user)["profile_complete"]:
        raise HTTPException(status_code=409, detail="请先完成头像、用户名、收货地区和至少 6 张作品照片")
    current_user.real_name = payload.real_name
    current_user.id_card_no = encrypt_sensitive(payload.id_card_no)
    current_user.alipay_account = payload.alipay_account
    current_user.alipay_real_name = payload.alipay_real_name
    current_user.verify_status = "pending"
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


@admin_router.post("/merchants", status_code=status.HTTP_201_CREATED)
def create_merchant(
    payload: AdminMerchantCreateRequest,
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    if session.scalar(select(User).where(User.phone == payload.phone)) is not None:
        raise HTTPException(status_code=409, detail="手机号已注册")
    merchant = User(
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role="merchant",
        nickname=payload.nickname or payload.shop_name,
    )
    merchant.merchant_profile = MerchantProfile(
        shop_name=payload.shop_name,
        shop_platform=payload.shop_platform,
        contact_phone=payload.contact_phone,
        default_ship_address=payload.default_ship_address,
    )
    session.add(merchant)
    session.commit()
    session.refresh(merchant)
    return {"code": 0, "message": "ok", "data": serialize_user(merchant, include_payment_details=False)}


@admin_router.put("/{user_id}/verify")
def review_verification(
    user_id: int,
    payload: VerifyReviewRequest,
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    if not payload.approved and not payload.reason:
        raise HTTPException(status_code=400, detail="驳回认证时必须填写原因")
    user.verify_status = "verified" if payload.approved else "rejected"
    user.verify_reject_reason = None if payload.approved else payload.reason
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(user, include_payment_details=False)}


@admin_router.put("/{user_id}/merchant-assurance")
def update_merchant_assurance(
    user_id: int,
    payload: MerchantAssuranceRequest,
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    user = session.get(User, user_id)
    if user is None or user.role != "merchant":
        raise HTTPException(status_code=404, detail="商家不存在")
    profile = user.merchant_profile
    if profile is None:
        profile = MerchantProfile(user=user, contact_phone=user.phone)
        session.add(profile)
    profile.quality_merchant = payload.quality_merchant
    profile.guarantee_deposit_paid = payload.guarantee_deposit_paid
    profile.guarantee_deposit_amount = payload.guarantee_deposit_amount
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(user, include_payment_details=False)}


@admin_router.get("")
def list_users(
    role: str | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
    verify_status: str | None = None,
    keyword: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(User)
    count_statement = select(func.count()).select_from(User)
    filters = []
    if role:
        filters.append(User.role == role)
    if status_filter:
        filters.append(User.status == status_filter)
    if verify_status:
        filters.append(User.verify_status == verify_status)
    if keyword:
        filters.append(or_(User.phone.contains(keyword), User.nickname.contains(keyword)))
    if filters:
        statement = statement.where(*filters)
        count_statement = count_statement.where(*filters)
    users = list(session.scalars(statement.order_by(User.created_at.desc(), User.id.desc()).offset((page - 1) * page_size).limit(page_size)))
    total = session.scalar(count_statement) or 0
    return {"code": 0, "message": "ok", "data": {"items": [serialize_user(item, include_payment_details=False) for item in users], "total": total, "page": page, "page_size": page_size}}


@admin_router.put("/{user_id}/status")
def update_user_status(
    user_id: int,
    payload: UserStatusUpdateRequest,
    current_admin: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="用户不存在")
    if user.id == current_admin.id and payload.status == "disabled":
        raise HTTPException(status_code=400, detail="不能禁用当前管理员账号")
    user.status = payload.status
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(user, include_payment_details=False)}
