from decimal import Decimal
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select

from app.main import app
from app.database import get_session_factory
from app.models.media import MediaAsset
from app.models.user import User
from app.security import create_access_token, hash_password


def register(client: TestClient, phone: str, role: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": "secure-password", "role": role},
    )
    return response.json()["data"]["access_token"]


def make_model_eligible(client: TestClient, token: str, phone: str) -> None:
    headers = {"Authorization": f"Bearer {token}"}
    assert client.put("/api/users/me", headers=headers, json={"nickname": "测试达人", "avatar_url": "/uploads/avatar.jpg"}).status_code == 200
    assert client.put(
        "/api/users/me/model-profile",
        headers=headers,
        json={
            "receive_address": "北京市 / 北京市 / 朝阳区",
            "receiver_name": "测试达人",
            "receiver_phone": phone,
            "receive_address_detail": "蓝影花园 1 栋 101 室",
            "portfolio_urls": [f"/uploads/portfolio-{index}.jpg" for index in range(6)],
        },
    ).status_code == 200
    with get_session_factory()() as session:
        user = session.scalar(select(User).where(User.phone == phone))
        assert user is not None
        user.verify_status = "verified"
        session.commit()


def admin_headers() -> dict[str, str]:
    with get_session_factory()() as session:
        admin = User(phone="13300000009", password_hash=hash_password("secure-password"), role="admin", nickname="管理员")
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def add_delivery_assets(phone: str, image_count: int = 6) -> list[str]:
    image_urls = [f"/uploads/{phone}-delivery-{index}.jpg" for index in range(image_count)]
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


def add_short_video_asset(phone: str) -> str:
    url = f"/uploads/{phone}-short-video.mp4"
    with get_session_factory()() as session:
        model = session.scalar(select(User).where(User.phone == phone))
        assert model is not None
        session.add(MediaAsset(owner_id=model.id, url=url, content_type="video/mp4", duration_seconds=Decimal("5.000")))
        session.commit()
    return url


def test_merchant_and_model_can_complete_order_delivery_flow() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13300000001', 'merchant')}"}
    model_headers = {"Authorization": f"Bearer {register(client, '13300000002', 'model')}"}
    admin = admin_headers()
    make_model_eligible(client, model_headers["Authorization"].removeprefix("Bearer "), "13300000002")

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

    assert client.post(f"/api/orders/{order_id}/applications", headers=model_headers, json={"message": "可以按时交付"}).status_code == 201
    application = client.get("/api/admin/order-applications", headers=admin, params={"status": "PENDING"}).json()["data"]["items"][0]
    assert client.put(f"/api/admin/order-applications/{application['id']}/review", headers=admin, json={"approved": True}).status_code == 200
    my_fulfillments = client.get("/api/orders/fulfillments/my", headers=model_headers)
    assert my_fulfillments.status_code == 200
    assert my_fulfillments.json()["data"]["total"] == 1
    assert my_fulfillments.json()["data"]["items"][0]["status"] == "CLAIMED"
    assert client.put(f"/api/orders/{order_id}/ship", headers=merchant_headers, json={"tracking_no": "SF100", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    submitted_media = add_delivery_assets("13300000002")
    short_video = add_short_video_asset("13300000002")
    missing_long_video = client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": [*submitted_media[:-1], short_video], "tracking_no": "SF200", "company": "顺丰"},
    )
    assert missing_long_video.status_code == 422
    assert "大于 5 秒" in missing_long_video.json()["message"]
    assert client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": submitted_media, "tracking_no": "SF200", "company": "顺丰"},
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


def test_upload_records_an_mp4_duration() -> None:
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {register(client, '13300000005', 'model')}"}

    def box(box_type: bytes, body: bytes) -> bytes:
        return (len(body) + 8).to_bytes(4, "big") + box_type + body

    movie_header = (
        b"\x00\x00\x00\x00"
        + b"\x00" * 8
        + (1_000).to_bytes(4, "big")
        + (6_000).to_bytes(4, "big")
    )
    mp4 = box(b"ftyp", b"isom\x00\x00\x02\x00isomiso2") + box(b"moov", box(b"mvhd", movie_header))
    uploaded = client.post("/api/uploads", headers=headers, files={"file": ("delivery.mp4", mp4, "video/mp4")})

    assert uploaded.status_code == 201
    assert uploaded.json()["data"]["content_type"] == "video/mp4"
    assert Decimal(uploaded.json()["data"]["duration_seconds"]) == Decimal("6")


def test_multi_talent_fulfillments_reopen_slots_and_complete_the_parent_order() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13300000010', 'merchant')}"}
    admin = admin_headers()
    model_phones = ["13300000011", "13300000012", "13300000013"]
    model_headers = [{"Authorization": f"Bearer {register(client, phone, 'model')}"} for phone in model_phones]
    media_by_phone: dict[str, list[str]] = {}
    for phone, headers in zip(model_phones, model_headers):
        make_model_eligible(client, headers["Authorization"].removeprefix("Bearer "), phone)
        media_by_phone[phone] = add_delivery_assets(phone)

    created = client.post(
        "/api/orders",
        headers=merchant_headers,
        json={
            "title": "Multi-talent owned product order",
            "description": "Independent fulfillment slots",
            "product_categories": ["\u5176\u4ed6"],
            "quantity": 2,
            "commission_amount": "88.00",
            "product_source": "talent_owned",
            "return_required": False,
            "self_keep_after_shoot": True,
        },
    )
    assert created.status_code == 201
    order_id = created.json()["data"]["id"]
    legacy_accept = client.put(f"/api/orders/{order_id}/accept", headers=merchant_headers)
    assert legacy_accept.status_code == 409
    assert "多人订单" in legacy_accept.json()["message"]

    for phone, headers in zip(model_phones, model_headers):
        applied = client.post(
            f"/api/orders/{order_id}/applications",
            headers=headers,
            json={"owned_product_images": [media_by_phone[phone][0]]},
        )
        assert applied.status_code == 201

    applications = client.get(
        "/api/admin/order-applications",
        headers=admin,
        params={"order_id": order_id, "status": "PENDING"},
    ).json()["data"]["items"]
    applications_by_model = {item["applicant"]["id"]: item["id"] for item in applications}
    with get_session_factory()() as session:
        model_ids = {
            phone: session.scalar(select(User.id).where(User.phone == phone))
            for phone in model_phones
        }

    for phone in model_phones[:2]:
        reviewed = client.put(
            f"/api/admin/order-applications/{applications_by_model[model_ids[phone]]}/review",
            headers=admin,
            json={"approved": True},
        )
        assert reviewed.status_code == 200

    workspace = client.get(f"/api/orders/{order_id}/workspace", headers=merchant_headers).json()["data"]
    assert workspace["summary"]["approved_quantity"] == 2
    first_fulfillment = next(item for item in workspace["fulfillments"] if item["model"]["id"] == model_ids[model_phones[0]])
    rejected = client.put(
        f"/api/orders/fulfillments/{first_fulfillment['id']}/owned-product-review",
        headers=merchant_headers,
        json={"approved": False, "reason": "Product does not match"},
    )
    assert rejected.status_code == 200

    reopened = client.get(f"/api/orders/{order_id}/workspace", headers=merchant_headers).json()["data"]
    assert reopened["summary"]["approved_quantity"] == 1
    assert reopened["summary"]["available_quantity"] == 1
    assert reopened["summary"]["recruitment_status"] == "OPEN"
    assert reopened["order"]["model_id"] == model_ids[model_phones[1]]

    third_review = client.put(
        f"/api/admin/order-applications/{applications_by_model[model_ids[model_phones[2]]]}/review",
        headers=admin,
        json={"approved": True},
    )
    assert third_review.status_code == 200
    refilled = client.get(f"/api/orders/{order_id}/workspace", headers=merchant_headers).json()["data"]
    assert refilled["summary"]["approved_quantity"] == 2
    assert refilled["summary"]["available_quantity"] == 0
    active_fulfillments = [item for item in refilled["fulfillments"] if item["status"] != "CANCELLED"]
    assert {item["slot_no"] for item in active_fulfillments} == {1, 2}

    for phone, headers in zip(model_phones[1:], model_headers[1:]):
        fulfillment = next(item for item in active_fulfillments if item["model"]["id"] == model_ids[phone])
        approved = client.put(
            f"/api/orders/fulfillments/{fulfillment['id']}/owned-product-review",
            headers=merchant_headers,
            json={"approved": True},
        )
        assert approved.status_code == 200
        submission = client.post(
            f"/api/orders/fulfillments/{fulfillment['id']}/submissions",
            headers=headers,
            json={"submitted_media": media_by_phone[phone]},
        )
        assert submission.status_code == 201
        premature_accept = client.put(
            f"/api/orders/fulfillments/{fulfillment['id']}/accept",
            headers=merchant_headers,
        )
        assert premature_accept.status_code == 409
        review = client.put(
            f"/api/orders/fulfillments/{fulfillment['id']}/submissions/{submission.json()['data']['id']}/review",
            headers=merchant_headers,
            json={"approved": True},
        )
        assert review.status_code == 200
        assert review.json()["data"]["status"] == "COMPLETED"

    completed = client.get(f"/api/orders/{order_id}", headers=merchant_headers)
    assert completed.status_code == 200
    assert completed.json()["data"]["status"] == "COMPLETED"


def test_order_errors_use_a_uniform_envelope() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13300000004', 'merchant')}"}

    response = client.put("/api/orders/999/accept", headers=merchant_headers)

    assert response.status_code == 404
    assert response.json() == {"code": 1004, "message": "订单不存在", "data": None}
