from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_role
from app.models.user import MerchantProfile, ModelProfile, User
from app.schemas.user import (
    MerchantProfileRequest,
    ModelProfileRequest,
    UserUpdateRequest,
    VerifyRequest,
    VerifyReviewRequest,
    UserStatusUpdateRequest,
)
from app.security import decrypt_sensitive, encrypt_sensitive, mask_id_card

router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin/users", tags=["admin users"])


def serialize_user(user: User, include_payment_details: bool = True) -> dict[str, object]:
    data: dict[str, object] = {
        "id": user.id,
        "phone": user.phone,
        "role": user.role,
        "nickname": user.nickname,
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
        }
    if user.model_profile:
        data["model_profile"] = {
            "height_cm": user.model_profile.height_cm,
            "weight_kg": user.model_profile.weight_kg,
            "shoe_size": user.model_profile.shoe_size,
            "skill_tags": user.model_profile.skill_tags,
            "receive_address": user.model_profile.receive_address,
            "portfolio_urls": user.model_profile.portfolio_urls,
        }
    return data


@router.get("/me")
def read_me(current_user: User = Depends(get_current_user)) -> dict[str, object]:
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


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
    for name, value in payload.model_dump().items():
        setattr(profile, name, value)
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


@router.post("/me/verify")
def submit_verification(
    payload: VerifyRequest,
    current_user: User = Depends(require_role("merchant", "model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    current_user.real_name = payload.real_name
    current_user.id_card_no = encrypt_sensitive(payload.id_card_no)
    current_user.alipay_account = payload.alipay_account
    current_user.alipay_real_name = payload.alipay_real_name
    current_user.verify_status = "pending"
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(current_user)}


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
