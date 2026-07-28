from typing import Literal

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["merchant", "model"]
    nickname: str | None = Field(default=None, max_length=50)


class LoginRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserUpdateRequest(BaseModel):
    nickname: str | None = Field(default=None, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=255)


class MerchantProfileRequest(BaseModel):
    shop_name: str = Field(min_length=1, max_length=100)
    shop_platform: str | None = Field(default=None, max_length=50)
    contact_phone: str = Field(min_length=6, max_length=20)
    default_ship_address: str = Field(min_length=1, max_length=255)


class ModelProfileRequest(BaseModel):
    height_cm: int | None = Field(default=None, ge=1, le=300)
    weight_kg: int | None = Field(default=None, ge=1, le=500)
    shoe_size: str | None = Field(default=None, max_length=10)
    skill_tags: str | None = Field(default=None, max_length=255)
    receive_address: str = Field(min_length=1, max_length=255)
    portfolio_urls: str | None = None


class VerifyRequest(BaseModel):
    real_name: str = Field(min_length=2, max_length=50)
    id_card_no: str = Field(min_length=8, max_length=30)
    alipay_account: str = Field(min_length=3, max_length=100)
    alipay_real_name: str = Field(min_length=2, max_length=50)


class VerifyReviewRequest(BaseModel):
    approved: bool
