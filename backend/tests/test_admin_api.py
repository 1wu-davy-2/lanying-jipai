from fastapi.testclient import TestClient

from app.database import get_session_factory
from app.main import app
from app.models.user import User
from app.security import create_access_token, hash_password


def register(client: TestClient, phone: str, role: str) -> str:
    response = client.post("/api/auth/register", json={"phone": phone, "password": "secure-password", "role": role})
    assert response.status_code == 201
    return response.json()["data"]["access_token"]


def admin_headers() -> dict[str, str]:
    with get_session_factory()() as session:
        admin = User(phone="13700000001", password_hash=hash_password("secure-password"), role="admin", nickname="管理员")
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def create_disputed_order(client: TestClient, merchant_headers: dict[str, str], model_headers: dict[str, str]) -> int:
    created = client.post("/api/orders", headers=merchant_headers, json={"title": "仲裁测试订单", "description": "拍摄", "commission_amount": "88.00"})
    order_id = created.json()["data"]["id"]
    assert client.post(f"/api/orders/{order_id}/claim", headers=model_headers).status_code == 200
    assert client.put(f"/api/orders/{order_id}/ship", headers=merchant_headers, json={"tracking_no": "SF100", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    assert client.put(f"/api/orders/{order_id}/submit", headers=model_headers, json={"submitted_media": ["/uploads/asset.jpg"], "tracking_no": "SF200", "company": "顺丰"}).status_code == 200
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
    model_headers = {"Authorization": f"Bearer {register(client, '13700000004', 'model')}"}
    admin = admin_headers()
    order_id = create_disputed_order(client, merchant_headers, model_headers)

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

    model_headers = {"Authorization": f"Bearer {register(client, '13700000006', 'model')}"}
    model = client.get("/api/users/me", headers=model_headers).json()["data"]
    invalid_target = client.post(
        "/api/admin/orders",
        headers=admin,
        json={"merchant_id": model["id"], "title": "错误目标", "description": "达人不能作为商家", "commission_amount": "1.00"},
    )
    assert invalid_target.status_code == 400

    created = client.post(
        "/api/admin/orders",
        headers=admin,
        json={
            "merchant_id": merchant["id"],
            "title": "运营代发测试订单",
            "description": "运营人员代商家发布",
            "commission_amount": "100.00",
        },
    )
    assert created.status_code == 201
    order_id = created.json()["data"]["id"]
    assert created.json()["data"]["merchant_id"] == merchant["id"]

    assert client.post(f"/api/orders/{order_id}/claim", headers=model_headers).status_code == 200
    assert client.put(f"/api/admin/orders/{order_id}/ship", headers=admin, json={"tracking_no": "SF300", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    assert client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": ["/uploads/submitted.jpg"], "tracking_no": "SF301", "company": "顺丰"},
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
        json={"merchant_id": merchant["id"], "title": "禁用商家", "description": "不应允许代发", "commission_amount": "1.00"},
    )
    assert disabled_target.status_code == 409
