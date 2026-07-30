from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_session_factory
from app.main import app
from app.models.user import User
from app.security import verify_password
from app.services.bootstrap import ensure_bootstrap_admin


def test_bootstrap_admin_is_created_once_without_resetting_its_password() -> None:
    with get_session_factory()() as session:
        created = ensure_bootstrap_admin(session)
        session.commit()
        assert created is not None
        original_hash = created.password_hash

    with get_session_factory()() as session:
        repeated = ensure_bootstrap_admin(session)
        session.commit()
        users = list(session.scalars(select(User).where(User.phone == "1111111112")))

    assert repeated is not None
    assert len(users) == 1
    assert users[0].role == "admin"
    assert users[0].nickname == "超级管理员"
    assert users[0].password_hash == original_hash
    assert verify_password("admin@123", users[0].password_hash)


def test_api_startup_bootstraps_an_administrator_that_can_log_in() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/auth/login",
            json={"phone": "1111111112", "password": "admin@123"},
        )

    assert response.status_code == 200
    assert response.json()["data"]["user"]["role"] == "admin"
