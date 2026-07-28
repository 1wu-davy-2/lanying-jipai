from sqlalchemy import select

from app.database import get_session_factory
from app.models.user import User
from app.models.wallet import Wallet
from scripts.seed import seed_demo_users


def test_seed_creates_idempotent_demo_accounts() -> None:
    with get_session_factory()() as session:
        seed_demo_users(session, "seed-password")
        session.commit()
    with get_session_factory()() as session:
        seed_demo_users(session, "seed-password")
        session.commit()
        users = list(session.scalars(select(User)))
        wallets = list(session.scalars(select(Wallet)))

    assert {(user.phone, user.role) for user in users} == {
        ("13000000001", "admin"), ("13000000002", "merchant"), ("13000000003", "model")
    }
    assert len(wallets) == 1
    assert wallets[0].user_id == next(user.id for user in users if user.role == "model")
