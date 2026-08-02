from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_db
from app.models.user import MerchantProfile, ModelProfile, User
from app.models.wallet import Wallet
from app.schemas.user import LoginRequest, RefreshRequest, RegisterRequest
from app.security import (
    clear_login_failures,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    login_is_locked,
    record_login_failure,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def token_payload(user: User) -> dict[str, object]:
    return {
        "access_token": create_access_token(user.id),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": {"id": user.id, "phone": user.phone, "role": user.role, "nickname": user.nickname},
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, session: Session = Depends(get_db)) -> dict[str, object]:
    if session.scalar(select(User).where(User.phone == payload.phone)) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="手机号已注册")
    user = User(
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        role=payload.role,
        nickname=payload.nickname or payload.phone[-4:],
        registration_channel=payload.registration_channel.strip() if payload.registration_channel else None,
    )
    if payload.role == "merchant":
        user.merchant_profile = MerchantProfile(contact_phone=payload.phone)
    else:
        user.model_profile = ModelProfile()
    session.add(user)
    session.flush()
    if payload.role == "model":
        session.add(Wallet(user_id=user.id))
    session.commit()
    session.refresh(user)
    return {"code": 0, "message": "ok", "data": token_payload(user)}


@router.post("/login")
def login(payload: LoginRequest, session: Session = Depends(get_db)) -> dict[str, object]:
    if login_is_locked(payload.phone):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="登录失败次数过多，请 15 分钟后重试")
    user = session.scalar(select(User).where(User.phone == payload.phone))
    if user is None or not verify_password(payload.password, user.password_hash):
        record_login_failure(payload.phone)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="手机号或密码错误")
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")
    clear_login_failures(payload.phone)
    return {"code": 0, "message": "ok", "data": token_payload(user)}


@router.post("/refresh")
def refresh(payload: RefreshRequest, session: Session = Depends(get_db)) -> dict[str, object]:
    try:
        user_id = decode_token(payload.refresh_token, "refresh")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    user = session.get(User, user_id)
    if user is None or user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号不存在或已被禁用")
    return {"code": 0, "message": "ok", "data": token_payload(user)}


@router.post("/logout")
def logout() -> dict[str, object]:
    return {"code": 0, "message": "ok", "data": None}
