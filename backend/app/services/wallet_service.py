from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.wallet import Wallet, WalletTransaction, Withdrawal
from app.security import encrypt_sensitive
from app.services.order_service import OrderConflictError, transition_order
from app.utils.withdrawal_no import new_withdrawal_no

ORDER_SETTLEMENT = "order_settlement"
WITHDRAWAL_FREEZE = "withdrawal_freeze"
WITHDRAWAL_COMPLETE = "withdrawal_complete"
WITHDRAWAL_REJECT_REFUND = "withdrawal_reject_refund"


class WalletConflictError(Exception):
    pass


def _wallet_for_update(session: Session, user_id: int) -> Wallet:
    wallet = session.scalar(select(Wallet).where(Wallet.user_id == user_id).with_for_update())
    if wallet is None:
        wallet = Wallet(user_id=user_id)
        session.add(wallet)
        session.flush()
    return wallet


def _change_wallet(
    session: Session,
    user_id: int,
    available_delta: Decimal,
    frozen_delta: Decimal,
    require_available: Decimal | None = None,
    require_frozen: Decimal | None = None,
) -> Wallet:
    wallet = _wallet_for_update(session, user_id)
    conditions = [Wallet.user_id == user_id]
    if require_available is not None:
        conditions.append(Wallet.available_balance >= require_available)
    if require_frozen is not None:
        conditions.append(Wallet.frozen_balance >= require_frozen)
    try:
        result = session.execute(
            update(Wallet)
            .where(*conditions)
            .values(
                available_balance=Wallet.available_balance + available_delta,
                frozen_balance=Wallet.frozen_balance + frozen_delta,
                updated_at=datetime.now(timezone.utc),
            )
        )
    except OperationalError as exc:
        raise WalletConflictError("余额操作冲突，请重试") from exc
    if result.rowcount != 1:
        raise WalletConflictError("可提现余额不足" if require_available is not None else "冻结余额异常")
    session.expire(wallet)
    session.refresh(wallet)
    return wallet


def complete_order_and_settle(session: Session, order: Order, operator_id: int) -> None:
    if order.model_id is None:
        raise WalletConflictError("订单未分配达人，无法结算")
    transition_order(session, order, "COMPLETED", operator_id, "商家验收通过并完成佣金结算")
    wallet = _change_wallet(session, order.model_id, order.commission_amount, Decimal("0.00"))
    session.add(
        WalletTransaction(
            idempotency_key=f"order:{order.id}:settlement",
            user_id=order.model_id,
            type=ORDER_SETTLEMENT,
            amount=order.commission_amount,
            balance_after=wallet.available_balance,
            frozen_balance_after=wallet.frozen_balance,
            order_id=order.id,
            remark=f"订单 {order.order_no} 佣金结算",
        )
    )


def create_withdrawal(
    session: Session,
    user_id: int,
    amount: Decimal,
    alipay_account: str,
    alipay_real_name: str,
) -> Withdrawal:
    wallet = _change_wallet(
        session,
        user_id,
        -amount,
        amount,
        require_available=amount,
    )
    withdrawal = Withdrawal(
        withdrawal_no=new_withdrawal_no(),
        user_id=user_id,
        amount=amount,
        alipay_account=encrypt_sensitive(alipay_account),
        alipay_real_name=alipay_real_name,
        status="pending",
    )
    session.add(withdrawal)
    session.flush()
    session.add(
        WalletTransaction(
            idempotency_key=f"withdrawal:{withdrawal.id}:freeze",
            user_id=user_id,
            type=WITHDRAWAL_FREEZE,
            amount=-amount,
            balance_after=wallet.available_balance,
            frozen_balance_after=wallet.frozen_balance,
            withdrawal_id=withdrawal.id,
            remark=f"提现申请 {withdrawal.withdrawal_no} 冻结余额",
        )
    )
    return withdrawal


def approve_withdrawal(session: Session, withdrawal_id: int, reviewer_id: int) -> Withdrawal:
    result = session.execute(
        update(Withdrawal)
        .where(Withdrawal.id == withdrawal_id, Withdrawal.status == "pending")
        .values(status="approved", reviewer_id=reviewer_id, updated_at=datetime.now(timezone.utc))
    )
    if result.rowcount != 1:
        raise WalletConflictError("提现单当前状态不允许审核")
    withdrawal = session.get(Withdrawal, withdrawal_id)
    assert withdrawal is not None
    return withdrawal


def reject_withdrawal(session: Session, withdrawal_id: int, reviewer_id: int, reason: str) -> Withdrawal:
    withdrawal = session.get(Withdrawal, withdrawal_id)
    if withdrawal is None:
        raise WalletConflictError("提现单不存在")
    result = session.execute(
        update(Withdrawal)
        .where(Withdrawal.id == withdrawal_id, Withdrawal.status == "pending")
        .values(status="rejected", reviewer_id=reviewer_id, reject_reason=reason, updated_at=datetime.now(timezone.utc))
    )
    if result.rowcount != 1:
        raise WalletConflictError("提现单当前状态不允许驳回")
    wallet = _change_wallet(
        session,
        withdrawal.user_id,
        withdrawal.amount,
        -withdrawal.amount,
        require_frozen=withdrawal.amount,
    )
    session.add(
        WalletTransaction(
            idempotency_key=f"withdrawal:{withdrawal.id}:refund",
            user_id=withdrawal.user_id,
            type=WITHDRAWAL_REJECT_REFUND,
            amount=withdrawal.amount,
            balance_after=wallet.available_balance,
            frozen_balance_after=wallet.frozen_balance,
            withdrawal_id=withdrawal.id,
            remark=f"提现申请 {withdrawal.withdrawal_no} 驳回退回",
        )
    )
    return withdrawal


def complete_withdrawal(session: Session, withdrawal_id: int, reviewer_id: int, transfer_no: str) -> Withdrawal:
    withdrawal = session.get(Withdrawal, withdrawal_id)
    if withdrawal is None:
        raise WalletConflictError("提现单不存在")
    result = session.execute(
        update(Withdrawal)
        .where(Withdrawal.id == withdrawal_id, Withdrawal.status == "approved")
        .values(
            status="completed",
            reviewer_id=reviewer_id,
            transfer_no=transfer_no,
            transferred_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
    )
    if result.rowcount != 1:
        raise WalletConflictError("提现单当前状态不允许登记转账")
    wallet = _change_wallet(
        session,
        withdrawal.user_id,
        Decimal("0.00"),
        -withdrawal.amount,
        require_frozen=withdrawal.amount,
    )
    session.add(
        WalletTransaction(
            idempotency_key=f"withdrawal:{withdrawal.id}:complete",
            user_id=withdrawal.user_id,
            type=WITHDRAWAL_COMPLETE,
            amount=Decimal("0.00"),
            balance_after=wallet.available_balance,
            frozen_balance_after=wallet.frozen_balance,
            withdrawal_id=withdrawal.id,
            remark=f"提现申请 {withdrawal.withdrawal_no} 已登记转账",
        )
    )
    return withdrawal


def ledger_balances(session: Session, user_id: int) -> tuple[Decimal, Decimal]:
    transactions = session.scalars(
        select(WalletTransaction).where(WalletTransaction.user_id == user_id).order_by(WalletTransaction.created_at, WalletTransaction.id)
    )
    available = Decimal("0.00")
    frozen = Decimal("0.00")
    for transaction in transactions:
        available += transaction.amount
        frozen = transaction.frozen_balance_after
    return available, frozen
