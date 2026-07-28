from fastapi import APIRouter, Depends, HTTPException
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
)
from app.security import decrypt_sensitive, encrypt_sensitive, mask_id_card

router = APIRouter(prefix="/users", tags=["users"])
admin_router = APIRouter(prefix="/admin/users", tags=["admin users"])


def serialize_user(user: User) -> dict[str, object]:
    data: dict[str, object] = {
        "id": user.id,
        "phone": user.phone,
        "role": user.role,
        "nickname": user.nickname,
        "avatar_url": user.avatar_url,
        "status": user.status,
        "real_name": user.real_name,
        "id_card_no": mask_id_card(decrypt_sensitive(user.id_card_no) if user.id_card_no else None),
        "alipay_account": user.alipay_account,
        "alipay_real_name": user.alipay_real_name,
        "verify_status": user.verify_status,
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
    user.verify_status = "verified" if payload.approved else "rejected"
    session.commit()
    return {"code": 0, "message": "ok", "data": serialize_user(user)}
