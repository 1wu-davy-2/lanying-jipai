from decimal import Decimal

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.product_categories import PRODUCT_CATEGORIES


class OrderCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    product_categories: list[str] = Field(min_length=1, max_length=3)
    sample_images: list[str] = Field(default_factory=list)
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
