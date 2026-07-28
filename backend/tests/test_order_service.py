from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier

import pytest
from sqlalchemy import select

from app.database import get_session_factory
from app.models.order import Order, OrderLog
from app.models.user import User
from app.services.order_service import OrderConflictError, claim_order, transition_order


def create_user(phone: str, role: str) -> User:
    with get_session_factory()() as session:
        user = User(phone=phone, password_hash="hash", role=role, nickname=phone[-4:])
        session.add(user)
        session.commit()
        session.refresh(user)
        return user


def create_order(merchant_id: int) -> Order:
    with get_session_factory()() as session:
        order = Order(
            order_no="JP20260728000001",
            merchant_id=merchant_id,
            title="夏季连衣裙寄拍",
            description="自然光拍摄",
            commission_amount=Decimal("168.00"),
            status="PUBLISHED",
        )
        session.add(order)
        session.commit()
        session.refresh(order)
        return order


def test_state_machine_rejects_illegal_transition() -> None:
    merchant = create_user("13800000001", "merchant")
    order = create_order(merchant.id)

    with get_session_factory()() as session:
        persisted = session.get(Order, order.id)
        assert persisted is not None
        with pytest.raises(OrderConflictError):
            transition_order(session, persisted, "COMPLETED", merchant.id)


def test_concurrent_claim_allows_exactly_one_model() -> None:
    merchant = create_user("13800000002", "merchant")
    first_model = create_user("13800000003", "model")
    second_model = create_user("13800000004", "model")
    order = create_order(merchant.id)

    def claim(model_id: int) -> bool:
        with get_session_factory()() as session:
            try:
                claim_order(session, order.id, model_id)
                return True
            except OrderConflictError:
                return False

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(claim, [first_model.id, second_model.id]))

    assert results.count(True) == 1
    with get_session_factory()() as session:
        persisted = session.scalar(select(Order).where(Order.id == order.id))
        assert persisted is not None
        assert persisted.status == "CLAIMED"
        assert persisted.model_id in {first_model.id, second_model.id}


def test_concurrent_status_transition_writes_one_state_and_one_log() -> None:
    merchant = create_user("13800000005", "merchant")
    order = create_order(merchant.id)
    with get_session_factory()() as session:
        persisted = session.get(Order, order.id)
        assert persisted is not None
        persisted.status = "RETURNED"
        session.commit()

    ready = Barrier(2)

    def advance(target_status: str) -> bool:
        with get_session_factory()() as session:
            persisted = session.get(Order, order.id)
            assert persisted is not None
            ready.wait()
            try:
                transition_order(session, persisted, target_status, merchant.id)
                session.commit()
                return True
            except OrderConflictError:
                return False

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(advance, ["COMPLETED", "DISPUTED"]))

    assert results.count(True) == 1
    with get_session_factory()() as session:
        persisted = session.get(Order, order.id)
        logs = list(session.scalars(select(OrderLog).where(OrderLog.order_id == order.id)))
        assert persisted is not None
        assert persisted.status in {"COMPLETED", "DISPUTED"}
        assert len(logs) == 1
        assert logs[0].from_status == "RETURNED"
