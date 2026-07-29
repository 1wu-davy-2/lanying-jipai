from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.product_categories import PRODUCT_CATEGORIES


class OrderCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    product_categories: list[str] = Field(min_length=1, max_length=3)
    sample_images: list[str] = Field(default_factory=list)
    order_type: Literal["product_photo", "try_on", "short_video", "live_show"] = "product_photo"
    quantity: int = Field(default=1, ge=1, le=1000)
    required_media_count: int = Field(default=6, ge=1, le=100)
    delivery_days: int = Field(default=5, ge=1, le=30)
    deposit_required: bool = False
    return_required: bool = True
    commission_amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    deposit_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    shoot_requirements: str | None = None

    @field_validator("product_categories")
    @classmethod
    def validate_product_categories(cls, categories: list[str]) -> list[str]:
        if len(categories) != len(set(categories)):
            raise ValueError("商品分类不能重复")
        if set(categories).difference(PRODUCT_CATEGORIES):
            raise ValueError("包含不支持的商品分类")
        return categories

    @model_validator(mode="after")
    def validate_deposit(self) -> "OrderCreateRequest":
        if self.deposit_required and self.deposit_amount <= 0:
            raise ValueError("要求缴纳押金时必须填写押金金额")
        return self


class AdminOrderCreateRequest(OrderCreateRequest):
    merchant_id: int = Field(gt=0)


class ShipmentRequest(BaseModel):
    tracking_no: str = Field(min_length=1, max_length=50)
    company: str = Field(min_length=1, max_length=50)


class SubmitOrderRequest(ShipmentRequest):
    submitted_media: list[str] = Field(min_length=1)


class RejectOrderRequest(BaseModel):
    reason: str = Field(min_length=1)


class OrderMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)


class ArbitrationRequest(BaseModel):
    winner: Literal["model", "merchant"]
    remark: str = Field(min_length=1, max_length=255)


class OrderApplicationRequest(BaseModel):
    message: str | None = Field(default=None, max_length=300)


class ApplicationReviewRequest(BaseModel):
    approved: bool
    reason: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_rejection_reason(self) -> "ApplicationReviewRequest":
        if not self.approved and not (self.reason or "").strip():
            raise ValueError("驳回申请时必须填写原因")
        return self
