from decimal import Decimal

from pydantic import BaseModel, Field


class WithdrawalCreateRequest(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    alipay_account: str = Field(min_length=1, max_length=100)
    alipay_real_name: str = Field(min_length=1, max_length=50)


class WithdrawalRejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=255)


class WithdrawalCompleteRequest(BaseModel):
    transfer_no: str = Field(min_length=1, max_length=100)
