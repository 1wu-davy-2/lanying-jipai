from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, model_validator


class RegisterRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["merchant", "model"]
    nickname: str | None = Field(default=None, max_length=50)
    registration_channel: str | None = Field(default=None, max_length=50)


class LoginRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class UserUpdateRequest(BaseModel):
    nickname: str | None = Field(default=None, min_length=2, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=255)


class MerchantProfileRequest(BaseModel):
    shop_name: str = Field(min_length=1, max_length=100)
    shop_platform: str | None = Field(default=None, max_length=50)
    contact_phone: str = Field(min_length=6, max_length=20)
    default_ship_address: str = Field(min_length=1, max_length=255)


class AdminMerchantCreateRequest(MerchantProfileRequest):
    phone: str = Field(min_length=6, max_length=20)
    password: str = Field(min_length=8, max_length=128)
    nickname: str | None = Field(default=None, max_length=50)


class ModelProfileRequest(BaseModel):
    height_cm: int | None = Field(default=None, ge=1, le=300)
    weight_kg: int | None = Field(default=None, ge=1, le=500)
    shoe_size: str | None = Field(default=None, max_length=10)
    skill_tags: str | None = Field(default=None, max_length=255)
    receive_address: str = Field(min_length=1, max_length=255)
    receiver_name: str = Field(min_length=2, max_length=50)
    receiver_phone: str = Field(min_length=6, max_length=20)
    receive_address_detail: str = Field(min_length=1, max_length=255)
    portfolio_urls: list[str] = Field(min_length=6, max_length=12)


class VerifyRequest(BaseModel):
    real_name: str = Field(min_length=2, max_length=50)
    id_card_no: str = Field(min_length=8, max_length=30)
    alipay_account: str = Field(min_length=3, max_length=100)
    alipay_real_name: str = Field(min_length=2, max_length=50)


class VerifyReviewRequest(BaseModel):
    approved: bool
    reason: str | None = Field(default=None, max_length=255)


class UserStatusUpdateRequest(BaseModel):
    status: Literal["active", "disabled"]


class MerchantAssuranceRequest(BaseModel):
    quality_merchant: bool
    guarantee_deposit_paid: bool
    guarantee_deposit_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)

    @model_validator(mode="after")
    def validate_guarantee_deposit(self) -> "MerchantAssuranceRequest":
        if self.guarantee_deposit_paid and self.guarantee_deposit_amount <= 0:
            raise ValueError("已缴纳保证金时必须填写保证金金额")
        if not self.guarantee_deposit_paid and self.guarantee_deposit_amount != 0:
            raise ValueError("未缴纳保证金时金额必须为 0")
        return self
