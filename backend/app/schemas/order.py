from decimal import Decimal

from pydantic import BaseModel, Field


class OrderCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    sample_images: list[str] = Field(default_factory=list)
    commission_amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    deposit_amount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    shoot_requirements: str | None = None


class ShipmentRequest(BaseModel):
    tracking_no: str = Field(min_length=1, max_length=50)
    company: str = Field(min_length=1, max_length=50)


class SubmitOrderRequest(ShipmentRequest):
    submitted_media: list[str] = Field(min_length=1)


class RejectOrderRequest(BaseModel):
    reason: str = Field(min_length=1)


class OrderMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
