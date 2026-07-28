from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction

router = APIRouter(prefix="/wallets", tags=["wallets"])
admin_router = APIRouter(prefix="/admin/wallets", tags=["admin wallets"])


def decimal_string(value: Decimal) -> str:
    return f"{value:.2f}"


def serialize_wallet(wallet: Wallet | None) -> dict[str, str]:
    if wallet is None:
        return {"available_balance": "0.00", "frozen_balance": "0.00"}
    return {
        "available_balance": decimal_string(wallet.available_balance),
        "frozen_balance": decimal_string(wallet.frozen_balance),
    }


def serialize_transaction(transaction: WalletTransaction) -> dict[str, object]:
    return {
        "id": transaction.id,
        "type": transaction.type,
        "amount": decimal_string(transaction.amount),
        "balance_after": decimal_string(transaction.balance_after),
        "frozen_balance_after": decimal_string(transaction.frozen_balance_after),
        "order_id": transaction.order_id,
        "withdrawal_id": transaction.withdrawal_id,
        "remark": transaction.remark,
        "created_at": transaction.created_at.isoformat() if transaction.created_at else None,
    }


@router.get("/me")
def read_my_wallet(user: User = Depends(require_role("model")), session: Session = Depends(get_db)) -> dict[str, object]:
    wallet = session.scalar(select(Wallet).where(Wallet.user_id == user.id))
    return {"code": 0, "message": "ok", "data": serialize_wallet(wallet)}


@router.get("/me/transactions")
def read_my_transactions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(WalletTransaction).where(WalletTransaction.user_id == user.id).order_by(WalletTransaction.created_at.desc(), WalletTransaction.id.desc())
    total = session.scalar(select(func.count()).select_from(WalletTransaction).where(WalletTransaction.user_id == user.id)) or 0
    transactions = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    return {
        "code": 0,
        "message": "ok",
        "data": {"items": [serialize_transaction(transaction) for transaction in transactions], "total": total, "page": page, "page_size": page_size},
    }


@admin_router.get("")
def list_wallets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(Wallet).order_by(Wallet.updated_at.desc())
    total = session.scalar(select(func.count()).select_from(Wallet)) or 0
    wallets = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    return {
        "code": 0,
        "message": "ok",
        "data": {"items": [{"user_id": wallet.user_id, **serialize_wallet(wallet)} for wallet in wallets], "total": total, "page": page, "page_size": page_size},
    }
