"""Verify that wallet balances can be reconstructed from immutable transactions."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session_factory
from app.models.wallet import Wallet
from app.services.wallet_service import ledger_balances


def find_inconsistent_wallets(session: Session) -> list[int]:
    inconsistent: list[int] = []
    for wallet in session.scalars(select(Wallet)):
        available, frozen = ledger_balances(session, wallet.user_id)
        if (available, frozen) != (wallet.available_balance, wallet.frozen_balance):
            inconsistent.append(wallet.user_id)
    return inconsistent


def main() -> None:
    with get_session_factory()() as session:
        inconsistent = find_inconsistent_wallets(session)
    if inconsistent:
        raise SystemExit(f"Wallet reconciliation failed for user IDs: {', '.join(map(str, inconsistent))}")
    print("Wallet reconciliation passed.")


if __name__ == "__main__":
    main()
