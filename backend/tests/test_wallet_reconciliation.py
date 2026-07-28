from decimal import Decimal

from sqlalchemy import select

from app.database import get_session_factory
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction
from scripts.verify_wallets import find_inconsistent_wallets


def test_wallet_reconciliation_detects_and_clears_drift() -> None:
    with get_session_factory()() as session:
        user = User(phone="13100000001", password_hash="hash", role="model", nickname="对账达人")
        session.add(user)
        session.flush()
        wallet = Wallet(user_id=user.id, available_balance=Decimal("10.00"), frozen_balance=Decimal("0.00"))
        session.add(wallet)
        session.add(WalletTransaction(idempotency_key="reconcile-1", user_id=user.id, type="order_settlement", amount=Decimal("10.00"), balance_after=Decimal("10.00"), frozen_balance_after=Decimal("0.00")))
        session.commit()

    with get_session_factory()() as session:
        assert find_inconsistent_wallets(session) == []
        wallet = session.scalar(select(Wallet))
        assert wallet is not None
        wallet.available_balance = Decimal("9.00")
        session.commit()

    with get_session_factory()() as session:
        assert find_inconsistent_wallets(session) != []
