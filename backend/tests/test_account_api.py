from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_session_factory
from app.main import app
from app.models.user import User
from app.security import hash_password


def test_register_login_and_read_current_user() -> None:
    client = TestClient(app)
    registration = client.post(
        "/api/auth/register",
        json={"phone": "13800138000", "password": "secure-password", "role": "merchant"},
    )

    assert registration.status_code == 201
    assert registration.json()["data"]["user"]["role"] == "merchant"

    login = client.post(
        "/api/auth/login",
        json={"phone": "13800138000", "password": "secure-password"},
    )

    assert login.status_code == 200
    access_token = login.json()["data"]["access_token"]
    me = client.get("/api/users/me", headers={"Authorization": f"Bearer {access_token}"})

    assert me.status_code == 200
    assert me.json()["data"]["phone"] == "13800138000"
    assert me.json()["data"]["merchant_profile"] is not None


def test_model_registration_keeps_nickname_and_acquisition_channel() -> None:
    client = TestClient(app)
    registration = client.post(
        "/api/auth/register",
        json={
            "phone": "13800138009",
            "password": "secure-password",
            "role": "model",
            "nickname": "试镜达人",
            "registration_channel": "douyin",
        },
    )

    assert registration.status_code == 201
    token = registration.json()["data"]["access_token"]
    me = client.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["data"]["nickname"] == "试镜达人"
    assert me.json()["data"]["registration_channel"] == "douyin"


def test_merchant_can_update_profile_and_submit_verification() -> None:
    client = TestClient(app)
    registration = client.post(
        "/api/auth/register",
        json={"phone": "13900139000", "password": "secure-password", "role": "merchant"},
    )
    token = registration.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    profile = client.put(
        "/api/users/me/merchant-profile",
        headers=headers,
        json={
            "shop_name": "蓝鹰店铺",
            "contact_phone": "13900139000",
            "default_ship_address": "上海市浦东新区",
        },
    )
    verify = client.post(
        "/api/users/me/verify",
        headers=headers,
        json={
            "real_name": "张三",
            "id_card_no": "110101199001011234",
            "alipay_account": "zhangsan@example.com",
            "alipay_real_name": "张三",
        },
    )

    assert profile.status_code == 200
    assert verify.status_code == 200
    assert verify.json()["data"]["verify_status"] == "pending"

    me = client.get("/api/users/me", headers=headers)
    assert me.json()["data"]["id_card_no"] == "110***********1234"

    with get_session_factory()() as session:
        stored_user = session.scalar(select(User).where(User.phone == "13900139000"))
        assert stored_user is not None
        assert stored_user.id_card_no != "110101199001011234"


def test_login_is_rate_limited_after_repeated_failed_attempts() -> None:
    client = TestClient(app)
    client.post(
        "/api/auth/register",
        json={"phone": "13700137000", "password": "secure-password", "role": "model"},
    )

    for _ in range(5):
        response = client.post(
            "/api/auth/login",
            json={"phone": "13700137000", "password": "wrong-password"},
        )
        assert response.status_code == 401

    locked = client.post(
        "/api/auth/login",
        json={"phone": "13700137000", "password": "secure-password"},
    )

    assert locked.status_code == 429


def test_refresh_token_and_admin_verification_review() -> None:
    client = TestClient(app)
    registration = client.post(
        "/api/auth/register",
        json={"phone": "13600136000", "password": "secure-password", "role": "model"},
    )
    user_id = registration.json()["data"]["user"]["id"]
    refreshed = client.post(
        "/api/auth/refresh",
        json={"refresh_token": registration.json()["data"]["refresh_token"]},
    )
    assert refreshed.status_code == 200

    with get_session_factory()() as session:
        session.add(
            User(
                phone="13500135000",
                password_hash=hash_password("secure-password"),
                role="admin",
                nickname="平台管理员",
            )
        )
        session.commit()

    admin_login = client.post(
        "/api/auth/login",
        json={"phone": "13500135000", "password": "secure-password"},
    )
    reviewed = client.put(
        f"/api/admin/users/{user_id}/verify",
        headers={"Authorization": f"Bearer {admin_login.json()['data']['access_token']}"},
        json={"approved": True},
    )

    assert reviewed.status_code == 200
    assert reviewed.json()["data"]["verify_status"] == "verified"
