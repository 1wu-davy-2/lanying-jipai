from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


def register(client: TestClient, phone: str, role: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": "secure-password", "role": role},
    )
    return response.json()["data"]["access_token"]


def test_merchant_and_model_can_complete_order_delivery_flow() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13300000001', 'merchant')}"}
    model_headers = {"Authorization": f"Bearer {register(client, '13300000002', 'model')}"}

    created = client.post(
        "/api/orders",
        headers=merchant_headers,
        json={
            "title": "夏季连衣裙寄拍",
            "description": "自然光拍摄",
            "product_categories": ["\u5176\u4ed6"], "commission_amount": "168.00",
            "sample_images": ["/uploads/sample.jpg"],
            "shoot_requirements": "交付 5 张精修图",
        },
    )
    assert created.status_code == 201
    order_id = created.json()["data"]["id"]

    hall = client.get("/api/orders/hall", headers=model_headers)
    assert hall.status_code == 200
    assert hall.json()["data"]["total"] == 1

    assert client.post(f"/api/orders/{order_id}/claim", headers=model_headers).status_code == 200
    assert client.put(f"/api/orders/{order_id}/ship", headers=merchant_headers, json={"tracking_no": "SF100", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    assert client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": ["/uploads/asset.jpg"], "tracking_no": "SF200", "company": "顺丰"},
    ).status_code == 200

    message = client.post(f"/api/orders/{order_id}/messages", headers=model_headers, json={"content": "素材已上传"})
    accepted = client.put(f"/api/orders/{order_id}/accept", headers=merchant_headers)

    assert message.status_code == 201
    assert accepted.status_code == 200
    assert accepted.json()["data"]["status"] == "COMPLETED"
    assert client.get(f"/api/orders/{order_id}/messages", headers=merchant_headers).json()["data"]["total"] == 1

    detail = client.get(f"/api/orders/{order_id}", headers=merchant_headers)
    assert detail.status_code == 200
    assert [item["to_status"] for item in detail.json()["data"]["logs"]] == [
        "CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED", "COMPLETED"
    ]


def test_order_categories_are_required_and_filter_the_hall() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13300000005', 'merchant')}"}
    model_headers = {"Authorization": f"Bearer {register(client, '13300000006', 'model')}"}
    clothing = "\u670d\u9970\u7a7f\u642d"
    beauty = "\u7f8e\u5986\u4e2a\u62a4"
    payload = {"title": "Category order", "description": "Category filtered order", "commission_amount": "50.00"}

    clothing_order = client.post("/api/orders", headers=merchant_headers, json={**payload, "product_categories": [clothing]})
    beauty_order = client.post("/api/orders", headers=merchant_headers, json={**payload, "title": "Beauty order", "product_categories": [beauty]})
    assert clothing_order.status_code == 201
    assert beauty_order.status_code == 201

    filtered = client.get("/api/orders/hall", headers=model_headers, params={"category": clothing})
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()["data"]["items"]] == [clothing_order.json()["data"]["id"]]
    assert filtered.json()["data"]["items"][0]["product_categories"] == [clothing]

    missing_category = client.post("/api/orders", headers=merchant_headers, json=payload)
    too_many_categories = client.post(
        "/api/orders",
        headers=merchant_headers,
        json={**payload, "product_categories": [clothing, beauty, "\u98df\u54c1\u996e\u6599", "\u5bb6\u5c45\u751f\u6d3b"]},
    )
    assert missing_category.status_code == 422
    assert too_many_categories.status_code == 422


def test_upload_rejects_unapproved_types_and_returns_a_static_url() -> None:
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {register(client, '13300000003', 'merchant')}"}

    rejected = client.post("/api/uploads", headers=headers, files={"file": ("notes.txt", b"not an image", "text/plain")})
    invalid_image = client.post("/api/uploads", headers=headers, files={"file": ("sample.png", b"not a png", "image/png")})
    image_buffer = BytesIO()
    Image.new("RGB", (1, 1), "white").save(image_buffer, format="PNG")
    png = image_buffer.getvalue()
    uploaded = client.post("/api/uploads", headers=headers, files={"file": ("sample.png", png, "image/png")})

    assert rejected.status_code == 400
    assert invalid_image.status_code == 400
    assert uploaded.status_code == 201
    assert uploaded.json()["data"]["url"].startswith("/uploads/")


def test_order_errors_use_a_uniform_envelope() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13300000004', 'merchant')}"}

    response = client.put("/api/orders/999/accept", headers=merchant_headers)

    assert response.status_code == 404
    assert response.json() == {"code": 1004, "message": "订单不存在", "data": None}
