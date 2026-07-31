import json
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_session_factory
from app.main import app
from app.models.media import MediaAsset
from app.models.user import User
from app.security import create_access_token, hash_password


def register(client: TestClient, phone: str, role: str) -> str:
    response = client.post("/api/auth/register", json={"phone": phone, "password": "secure-password", "role": role})
    assert response.status_code == 201
    return response.json()["data"]["access_token"]


def make_model_eligible(phone: str) -> None:
    with get_session_factory()() as session:
        model = session.scalar(select(User).where(User.phone == phone))
        assert model is not None and model.model_profile is not None
        model.nickname = "测试达人"
        model.avatar_url = "/uploads/avatar.jpg"
        model.verify_status = "verified"
        model.model_profile.receive_address = "北京市 / 北京市 / 朝阳区"
        model.model_profile.receiver_name = "测试达人"
        model.model_profile.receiver_phone = phone
        model.model_profile.receive_address_detail = "蓝影花园 1 栋 101 室"
        model.model_profile.portfolio_urls = json.dumps([f"/uploads/{index}.jpg" for index in range(6)])
        session.commit()


def admin_headers() -> dict[str, str]:
    with get_session_factory()() as session:
        admin = User(phone="13700000001", password_hash=hash_password("secure-password"), role="admin", nickname="管理员")
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def add_delivery_assets(phone: str) -> list[str]:
    image_urls = [f"/uploads/{phone}-delivery-{index}.jpg" for index in range(6)]
    video_url = f"/uploads/{phone}-delivery.mp4"
    with get_session_factory()() as session:
        model = session.scalar(select(User).where(User.phone == phone))
        assert model is not None
        session.add_all(
            [MediaAsset(owner_id=model.id, url=url, content_type="image/jpeg") for url in image_urls]
            + [MediaAsset(owner_id=model.id, url=video_url, content_type="video/mp4", duration_seconds=Decimal("6.000"))]
        )
        session.commit()
    return [*image_urls, video_url]


def approve_application(client: TestClient, order_id: int, model_headers: dict[str, str], admin: dict[str, str]) -> None:
    assert client.post(f"/api/orders/{order_id}/applications", headers=model_headers, json={"message": "申请接单"}).status_code == 201
    applications = client.get("/api/admin/order-applications", headers=admin, params={"status": "PENDING"}).json()["data"]["items"]
    application = next(item for item in applications if item["order"]["id"] == order_id)
    assert client.put(f"/api/admin/order-applications/{application['id']}/review", headers=admin, json={"approved": True}).status_code == 200


def create_disputed_order(
    client: TestClient,
    merchant_headers: dict[str, str],
    model_headers: dict[str, str],
    admin: dict[str, str],
    model_phone: str,
) -> int:
    created = client.post("/api/orders", headers=merchant_headers, json={"title": "仲裁测试订单", "description": "拍摄", "product_categories": ["\u5176\u4ed6"], "commission_amount": "88.00"})
    order_id = created.json()["data"]["id"]
    approve_application(client, order_id, model_headers, admin)
    assert client.put(f"/api/orders/{order_id}/ship", headers=merchant_headers, json={"tracking_no": "SF100", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    assert client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": add_delivery_assets(model_phone), "tracking_no": "SF200", "company": "顺丰"},
    ).status_code == 200
    assert client.put(f"/api/orders/{order_id}/reject", headers=merchant_headers, json={"reason": "素材不符合要求"}).status_code == 200
    return order_id


def test_admin_can_filter_users_and_disable_an_account() -> None:
    client = TestClient(app)
    model_token = register(client, "13700000002", "model")
    admin = admin_headers()

    listed = client.get("/api/admin/users", headers=admin, params={"role": "model", "keyword": "13700000002"})
    assert listed.status_code == 200
    model = listed.json()["data"]["items"][0]
    assert model["phone"] == "13700000002"
    assert client.put(f"/api/admin/users/{model['id']}/status", headers=admin, json={"status": "disabled"}).status_code == 200

    denied = client.get("/api/users/me", headers={"Authorization": f"Bearer {model_token}"})
    assert denied.status_code == 403
    assert denied.json() == {"code": 1007, "message": "账号已被禁用", "data": None}


def test_admin_can_arbitrate_a_dispute_and_view_dashboard() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13700000003', 'merchant')}"}
    model_token = register(client, "13700000004", "model")
    make_model_eligible("13700000004")
    model_headers = {"Authorization": f"Bearer {model_token}"}
    admin = admin_headers()
    order_id = create_disputed_order(client, merchant_headers, model_headers, admin, "13700000004")

    disputed = client.get("/api/admin/orders/disputed", headers=admin)
    assert disputed.status_code == 200
    assert disputed.json()["data"]["total"] == 1
    arbitration = client.put(f"/api/admin/orders/{order_id}/arbitrate", headers=admin, json={"winner": "model", "remark": "素材符合要求"})
    assert arbitration.status_code == 200
    assert arbitration.json()["data"]["status"] == "COMPLETED"

    monitored = client.get("/api/admin/orders", headers=admin, params={"status_filter": "COMPLETED", "keyword": "仲裁测试"})
    assert monitored.status_code == 200
    assert monitored.json()["data"]["total"] == 1
    dashboard = client.get("/api/admin/dashboard/summary", headers=admin)
    assert dashboard.status_code == 200
    assert dashboard.json()["data"]["month_completed_amount"] == "88.00"


def test_admin_can_operate_orders_for_a_selected_merchant() -> None:
    client = TestClient(app)
    admin = admin_headers()
    merchant_response = client.post(
        "/api/admin/users/merchants",
        headers=admin,
        json={
            "phone": "13700000005",
            "password": "secure-password",
            "nickname": "运营代发商家",
            "shop_name": "运营店铺",
            "shop_platform": "淘宝",
            "contact_phone": "13700000005",
            "default_ship_address": "上海市浦东新区",
        },
    )
    assert merchant_response.status_code == 201
    merchant = merchant_response.json()["data"]
    assert merchant["role"] == "merchant"
    assert merchant["merchant_profile"]["shop_name"] == "运营店铺"

    duplicate = client.post(
        "/api/admin/users/merchants",
        headers=admin,
        json={
            "phone": "13700000005",
            "password": "secure-password",
            "shop_name": "重复店铺",
            "contact_phone": "13700000005",
            "default_ship_address": "上海市浦东新区",
        },
    )
    assert duplicate.status_code == 409

    model_token = register(client, "13700000006", "model")
    make_model_eligible("13700000006")
    model_headers = {"Authorization": f"Bearer {model_token}"}
    model = client.get("/api/users/me", headers=model_headers).json()["data"]
    invalid_target = client.post(
        "/api/admin/orders",
        headers=admin,
        json={"merchant_id": model["id"], "title": "错误目标", "description": "达人不能作为商家", "product_categories": ["\u5176\u4ed6"], "commission_amount": "1.00"},
    )
    assert invalid_target.status_code == 400

    created = client.post(
        "/api/admin/orders",
        headers=admin,
        json={
            "merchant_id": merchant["id"],
            "title": "运营代发测试订单",
            "description": "运营人员代商家发布",
            "product_categories": ["\u5176\u4ed6"], "commission_amount": "100.00",
        },
    )
    assert created.status_code == 201
    order_id = created.json()["data"]["id"]
    assert created.json()["data"]["merchant_id"] == merchant["id"]

    approve_application(client, order_id, model_headers, admin)
    assert client.put(f"/api/admin/orders/{order_id}/ship", headers=admin, json={"tracking_no": "SF300", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    submitted_media = add_delivery_assets("13700000006")
    assert client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": submitted_media, "tracking_no": "SF301", "company": "顺丰"},
    ).status_code == 200
    accepted = client.put(f"/api/admin/orders/{order_id}/accept", headers=admin)
    assert accepted.status_code == 200
    assert accepted.json()["data"]["status"] == "COMPLETED"
    assert client.put(f"/api/admin/orders/{order_id}/accept", headers=admin).status_code == 409

    detail = client.get(f"/api/orders/{order_id}", headers=admin)
    assert detail.status_code == 200
    data = detail.json()["data"]
    assert data["merchant"]["id"] == merchant["id"]
    assert [log["to_status"] for log in data["logs"]] == ["PUBLISHED", "CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED", "COMPLETED"]
    assert all(log["operator"]["role"] == "admin" for log in (data["logs"][0], data["logs"][2], data["logs"][-1]))

    filtered = client.get("/api/admin/orders", headers=admin, params={"merchant_id": merchant["id"]})
    assert filtered.status_code == 200
    assert [order["id"] for order in filtered.json()["data"]["items"]] == [order_id]

    wallet = client.get("/api/wallets/me", headers=model_headers)
    assert wallet.status_code == 200
    assert wallet.json()["data"]["available_balance"] == "100.00"

    assert client.put(f"/api/admin/users/{merchant['id']}/status", headers=admin, json={"status": "disabled"}).status_code == 200
    disabled_target = client.post(
        "/api/admin/orders",
        headers=admin,
        json={"merchant_id": merchant["id"], "title": "禁用商家", "description": "不应允许代发", "product_categories": ["\u5176\u4ed6"], "commission_amount": "1.00"},
    )
    assert disabled_target.status_code == 409
