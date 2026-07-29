from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.database import get_session_factory
from app.main import app
from app.models.user import User
from app.models.wallet import Wallet, WalletTransaction, Withdrawal
from app.security import create_access_token, hash_password
from app.services.wallet_service import WalletConflictError, create_withdrawal


def register(client: TestClient, phone: str, role: str) -> str:
    response = client.post("/api/auth/register", json={"phone": phone, "password": "secure-password", "role": role})
    assert response.status_code == 201
    return response.json()["data"]["access_token"]


def admin_headers() -> dict[str, str]:
    with get_session_factory()() as session:
        admin = User(phone="13900000001", password_hash=hash_password("secure-password"), role="admin", nickname="管理员")
        session.add(admin)
        session.commit()
        session.refresh(admin)
        return {"Authorization": f"Bearer {create_access_token(admin.id)}"}


def complete_order(client: TestClient, merchant_headers: dict[str, str], model_headers: dict[str, str]) -> int:
    created = client.post(
        "/api/orders",
        headers=merchant_headers,
        json={"title": "结算测试订单", "description": "拍摄", "product_categories": ["\u5176\u4ed6"], "commission_amount": "168.00"},
    )
    order_id = created.json()["data"]["id"]
    assert client.post(f"/api/orders/{order_id}/claim", headers=model_headers).status_code == 200
    assert client.put(f"/api/orders/{order_id}/ship", headers=merchant_headers, json={"tracking_no": "SF100", "company": "顺丰"}).status_code == 200
    assert client.put(f"/api/orders/{order_id}/receive", headers=model_headers).status_code == 200
    assert client.put(
        f"/api/orders/{order_id}/submit",
        headers=model_headers,
        json={"submitted_media": ["/uploads/asset.jpg"], "tracking_no": "SF200", "company": "顺丰"},
    ).status_code == 200
    assert client.put(f"/api/orders/{order_id}/accept", headers=merchant_headers).status_code == 200
    return order_id


def test_order_settlement_and_withdrawal_lifecycle() -> None:
    client = TestClient(app)
    merchant_headers = {"Authorization": f"Bearer {register(client, '13900000002', 'merchant')}"}
    model_headers = {"Authorization": f"Bearer {register(client, '13900000003', 'model')}"}
    admin = admin_headers()
    order_id = complete_order(client, merchant_headers, model_headers)

    wallet = client.get("/api/wallets/me", headers=model_headers)
    assert wallet.status_code == 200
    assert wallet.json()["data"] == {"available_balance": "168.00", "frozen_balance": "0.00"}
    transactions = client.get("/api/wallets/me/transactions", headers=model_headers).json()["data"]
    assert transactions["items"][0]["type"] == "order_settlement"
    assert transactions["items"][0]["order_id"] == order_id
    repeat_accept = client.put(f"/api/orders/{order_id}/accept", headers=merchant_headers)
    assert repeat_accept.status_code == 409
    assert client.get("/api/wallets/me/transactions", headers=model_headers).json()["data"]["total"] == 1

    rejected = client.post(
        "/api/withdrawals",
        headers=model_headers,
        json={"amount": "68.00", "alipay_account": "model@example.com", "alipay_real_name": "达人"},
    )
    assert rejected.status_code == 201
    rejected_id = rejected.json()["data"]["id"]
    assert client.put(f"/api/admin/withdrawals/{rejected_id}/reject", headers=admin, json={"reason": "资料待补充"}).status_code == 200

    pending = client.post(
        "/api/withdrawals",
        headers=model_headers,
        json={"amount": "100.00", "alipay_account": "model@example.com", "alipay_real_name": "达人"},
    )
    pending_id = pending.json()["data"]["id"]
    assert client.put(f"/api/admin/withdrawals/{pending_id}/approve", headers=admin).status_code == 200
    assert client.put(f"/api/admin/withdrawals/{pending_id}/complete", headers=admin, json={"transfer_no": "ALIPAY-100"}).status_code == 200

    wallet_after = client.get("/api/wallets/me", headers=model_headers).json()["data"]
    assert wallet_after == {"available_balance": "68.00", "frozen_balance": "0.00"}
    history = client.get("/api/wallets/me/transactions", headers=model_headers).json()["data"]["items"]
    assert [item["type"] for item in history] == [
        "withdrawal_complete", "withdrawal_freeze", "withdrawal_reject_refund", "withdrawal_freeze", "order_settlement"
    ]


def test_withdrawal_rejects_amount_above_available_balance() -> None:
    client = TestClient(app)
    model_headers = {"Authorization": f"Bearer {register(client, '13900000004', 'model')}"}

    response = client.post(
        "/api/withdrawals",
        headers=model_headers,
        json={"amount": "1.00", "alipay_account": "model@example.com", "alipay_real_name": "达人"},
    )

    assert response.status_code == 409
    assert response.json() == {"code": 1005, "message": "可提现余额不足", "data": None}


def test_concurrent_withdrawals_cannot_overdraw_a_wallet() -> None:
    client = TestClient(app)
    register(client, "13900000005", "model")
    with get_session_factory()() as session:
        user = session.scalar(select(User).where(User.phone == "13900000005"))
        assert user is not None
        wallet = session.scalar(select(Wallet).where(Wallet.user_id == user.id))
        assert wallet is not None
        wallet.available_balance = Decimal("100.00")
        session.commit()
        user_id = user.id

    ready = Barrier(2)

    def request_withdrawal() -> bool:
        with get_session_factory()() as session:
            ready.wait()
            try:
                create_withdrawal(session, user_id, Decimal("75.00"), "model@example.com", "达人")
                session.commit()
                return True
            except WalletConflictError:
                session.rollback()
                return False

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: request_withdrawal(), range(2)))

    assert results.count(True) == 1
    with get_session_factory()() as session:
        wallet = session.scalar(select(Wallet).where(Wallet.user_id == user_id))
        assert wallet is not None
        assert wallet.available_balance == Decimal("25.00")
        assert wallet.frozen_balance == Decimal("75.00")
        assert len(list(session.scalars(select(Withdrawal).where(Withdrawal.user_id == user_id)))) == 1
        assert len(list(session.scalars(select(WalletTransaction).where(WalletTransaction.user_id == user_id)))) == 1
