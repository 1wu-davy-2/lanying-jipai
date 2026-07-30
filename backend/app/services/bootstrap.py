"""Bootstrap the first administrator account for a newly initialized database."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.user import User
from app.security import hash_password


def ensure_bootstrap_admin(session: Session, settings: Settings | None = None) -> User | None:
    """Create the configured administrator once, without resetting an existing password."""
    settings = settings or Settings()
    if not settings.bootstrap_admin_enabled:
        return None

    existing = session.scalar(select(User).where(User.phone == settings.bootstrap_admin_phone))
    if existing is not None:
        return existing

    admin = User(
        phone=settings.bootstrap_admin_phone,
        password_hash=hash_password(settings.bootstrap_admin_password),
        role="admin",
        nickname=settings.bootstrap_admin_nickname,
    )
    session.add(admin)
    session.flush()
    return admin
