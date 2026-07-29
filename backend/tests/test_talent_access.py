from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_session_factory
from app.main import app
from app.models.order import Order
from app.models.user import User
from app.security import create_access_token, hash_password


def register(client: TestClient, phone: str, role: str) -> str:
    response = client.post("/api/auth/register", json={"phone": phone, "password": "secure-password", "role": role})
    assert response.status_code == 201
    return response.json()["data"]["access_token"]


def create_order(client: TestClient, headers: dict[str, str], title: str, commission: str = "300.00") -> int:
    response = client.post(
        "/api/orders",
        headers=headers,
        json={"title": title, "description": "用于达人权限测试", "product_categories": ["其他"], "commission_amount": commission},
    )
    assert response.status_code == 201
    return response.json()["data"]["id"]


def admin_headers() -> dict[str, str]:
    with get_session_factory()() as session:
        admin = User(phone="13400000009", password_hash=hash_password("secure-password"), role="admin", nickname="管理员")
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def test_talent_onboarding_verification_and_level_limits() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13400000001', 'merchant')}"}
    token = register(client, "13400000002", "model")
    model_headers = {"Authorization": f"Bearer {token}"}
    admin = admin_headers()
    order_id = create_order(client, merchant_headers, "新手订单")

    incomplete = client.post(f"/api/orders/{order_id}/applications", headers=model_headers, json={})
    assert incomplete.status_code == 403
    assert "至少 6 张作品" in incomplete.json()["message"]

    assert client.put("/api/users/me", headers=model_headers, json={"nickname": "小林", "avatar_url": "/uploads/avatar.jpg"}).status_code == 200
    profile = client.put(
        "/api/users/me/model-profile",
        headers=model_headers,
        json={
            "receive_address": "上海市 / 上海市 / 浦东新区",
            "receiver_name": "林小",
            "receiver_phone": "13400000002",
            "receive_address_detail": "东方路 88 号 1202 室",
            "portfolio_urls": [f"/uploads/{index}.jpg" for index in range(6)],
        },
    )
    assert profile.status_code == 200
    assert profile.json()["data"]["model_profile"]["portfolio_urls"] == [f"/uploads/{index}.jpg" for index in range(6)]

    verify = client.post(
        "/api/users/me/verify",
        headers=model_headers,
        json={"real_name": "林小", "id_card_no": "110101199001011234", "alipay_account": "lin@example.com", "alipay_real_name": "林小"},
    )
    assert verify.status_code == 200
    pending = client.post(f"/api/orders/{order_id}/applications", headers=model_headers, json={})
    assert pending.status_code == 403
    assert "实名认证" in pending.json()["message"]

    with get_session_factory()() as session:
        model = session.scalar(select(User).where(User.phone == "13400000002"))
        assert model is not None
        model.verify_status = "verified"
        session.commit()

    status = client.get("/api/users/me/talent-status", headers=model_headers)
    assert status.status_code == 200
    assert status.json()["data"]["level"]["code"] == "L1"
    assert status.json()["data"]["can_claim"] is True
    assert client.post(f"/api/orders/{order_id}/applications", headers=model_headers, json={"message": "申请接单"}).status_code == 201
    application = client.get("/api/admin/order-applications", headers=admin, params={"status": "PENDING"}).json()["data"]["items"][0]
    assert client.put(f"/api/admin/order-applications/{application['id']}/review", headers=admin, json={"approved": True}).status_code == 200

    second_order_id = create_order(client, merchant_headers, "第二个订单")
    concurrent_limit = client.post(f"/api/orders/{second_order_id}/applications", headers=model_headers, json={})
    assert concurrent_limit.status_code == 403
    assert "最多可接 1 单" in concurrent_limit.json()["message"]

    with get_session_factory()() as session:
        claimed_order = session.get(Order, order_id)
        assert claimed_order is not None
        claimed_order.status = "COMPLETED"
        session.commit()

    expensive_order_id = create_order(client, merchant_headers, "超出等级佣金", commission="301.00")
    expensive = client.post(f"/api/orders/{expensive_order_id}/applications", headers=model_headers, json={})
    assert expensive.status_code == 403
    assert "单笔佣金上限" in expensive.json()["message"]


def test_model_ranking_distinguishes_simulated_and_real_data() -> None:
    client = TestClient(app)
    token = register(client, "13400000003", "model")
    headers = {"Authorization": f"Bearer {token}"}
    with get_session_factory()() as session:
        model = session.scalar(select(User).where(User.phone == "13400000003"))
        assert model is not None
        model.verify_status = "verified"
        model.nickname = "真实达人"
        session.add(
            Order(
                order_no="JP20260729000001",
                merchant_id=model.id,
                model_id=model.id,
                title="已完成订单",
                description="排行榜数据",
                commission_amount=Decimal("268.00"),
                status="COMPLETED",
            )
        )
        session.commit()

    response = client.get("/api/users/model-ranking", headers=headers)
    assert response.status_code == 200
    assert response.json()["data"]["simulated"][0]["is_simulated"] is True
    assert response.json()["data"]["real"][0]["nickname"] == "真实达人"
    assert response.json()["data"]["real"][0]["is_simulated"] is False
