"""Create idempotent demonstration accounts for local development."""

import argparse
import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_session_factory
from app.models.user import MerchantProfile, ModelProfile, User
from app.models.wallet import Wallet
from app.security import hash_password

DEMO_USERS = (
    ("13000000001", "admin", "平台管理员"),
    ("13000000002", "merchant", "演示商家"),
    ("13000000003", "model", "演示达人"),
)


def seed_demo_users(session: Session, password: str) -> None:
    for phone, role, nickname in DEMO_USERS:
        user = session.scalar(select(User).where(User.phone == phone))
        if user is not None:
            continue
        user = User(phone=phone, password_hash=hash_password(password), role=role, nickname=nickname)
        if role == "merchant":
            user.merchant_profile = MerchantProfile(contact_phone=phone)
        elif role == "model":
            user.model_profile = ModelProfile()
        session.add(user)
        session.flush()
        if role == "model":
            session.add(Wallet(user_id=user.id))


def main() -> None:
    parser = argparse.ArgumentParser(description="Create demonstration administrator, merchant, and model accounts.")
    parser.add_argument("--password", default=os.getenv("SEED_PASSWORD"), help="Shared demo account password; alternatively set SEED_PASSWORD.")
    args = parser.parse_args()
    if not args.password:
        parser.error("provide --password or set SEED_PASSWORD")
    with get_session_factory()() as session:
        seed_demo_users(session, args.password)
        session.commit()
    print("Demo accounts are ready: 13000000001 (admin), 13000000002 (merchant), 13000000003 (model).")


if __name__ == "__main__":
    main()
