from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_role
from app.models.user import User
from app.models.wallet import Withdrawal
from app.schemas.wallet import WithdrawalCompleteRequest, WithdrawalCreateRequest, WithdrawalRejectRequest
from app.security import decrypt_sensitive
from app.services.wallet_service import (
    WalletConflictError,
    approve_withdrawal,
    complete_withdrawal,
    create_withdrawal,
    reject_withdrawal,
)

router = APIRouter(prefix="/withdrawals", tags=["withdrawals"])
admin_router = APIRouter(prefix="/admin/withdrawals", tags=["admin withdrawals"])


def serialize_withdrawal(withdrawal: Withdrawal, include_alipay_account: bool = False) -> dict[str, object]:
    account = decrypt_sensitive(withdrawal.alipay_account) if include_alipay_account else None
    return {
        "id": withdrawal.id,
        "withdrawal_no": withdrawal.withdrawal_no,
        "user_id": withdrawal.user_id,
        "amount": f"{withdrawal.amount:.2f}",
        "alipay_account": account,
        "alipay_real_name": withdrawal.alipay_real_name if include_alipay_account else None,
        "status": withdrawal.status,
        "reviewer_id": withdrawal.reviewer_id,
        "reject_reason": withdrawal.reject_reason,
        "transfer_no": withdrawal.transfer_no,
        "transferred_at": withdrawal.transferred_at.isoformat() if withdrawal.transferred_at else None,
        "created_at": withdrawal.created_at.isoformat() if withdrawal.created_at else None,
    }


def commit_or_conflict(session: Session, callback):
    try:
        result = callback()
        session.commit()
        return result
    except (WalletConflictError, IntegrityError, OperationalError) as exc:
        session.rollback()
        raise HTTPException(status_code=409, detail=str(exc) or "余额操作冲突，请重试") from exc


@router.post("", status_code=status.HTTP_201_CREATED)
def apply_withdrawal(
    payload: WithdrawalCreateRequest,
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    withdrawal = commit_or_conflict(
        session,
        lambda: create_withdrawal(session, user.id, payload.amount, payload.alipay_account, payload.alipay_real_name),
    )
    session.refresh(withdrawal)
    return {"code": 0, "message": "ok", "data": serialize_withdrawal(withdrawal)}


@router.get("/me")
def list_my_withdrawals(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user: User = Depends(require_role("model")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(Withdrawal).where(Withdrawal.user_id == user.id).order_by(Withdrawal.created_at.desc(), Withdrawal.id.desc())
    total = session.scalar(select(func.count()).select_from(Withdrawal).where(Withdrawal.user_id == user.id)) or 0
    withdrawals = list(session.scalars(statement.offset((page - 1) * page_size).limit(page_size)))
    return {"code": 0, "message": "ok", "data": {"items": [serialize_withdrawal(item) for item in withdrawals], "total": total, "page": page, "page_size": page_size}}


@admin_router.get("")
def list_withdrawals(
    status_filter: str | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    statement = select(Withdrawal)
    total_statement = select(func.count()).select_from(Withdrawal)
    if status_filter:
        statement = statement.where(Withdrawal.status == status_filter)
        total_statement = total_statement.where(Withdrawal.status == status_filter)
    withdrawals = list(session.scalars(statement.order_by(Withdrawal.created_at.desc(), Withdrawal.id.desc()).offset((page - 1) * page_size).limit(page_size)))
    total = session.scalar(total_statement) or 0
    return {"code": 0, "message": "ok", "data": {"items": [serialize_withdrawal(item, include_alipay_account=True) for item in withdrawals], "total": total, "page": page, "page_size": page_size}}


@admin_router.put("/{withdrawal_id}/approve")
def approve(
    withdrawal_id: int,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    withdrawal = commit_or_conflict(session, lambda: approve_withdrawal(session, withdrawal_id, user.id))
    session.refresh(withdrawal)
    return {"code": 0, "message": "ok", "data": serialize_withdrawal(withdrawal, include_alipay_account=True)}


@admin_router.put("/{withdrawal_id}/reject")
def reject(
    withdrawal_id: int,
    payload: WithdrawalRejectRequest,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    withdrawal = commit_or_conflict(session, lambda: reject_withdrawal(session, withdrawal_id, user.id, payload.reason))
    session.refresh(withdrawal)
    return {"code": 0, "message": "ok", "data": serialize_withdrawal(withdrawal, include_alipay_account=True)}


@admin_router.put("/{withdrawal_id}/complete")
def complete(
    withdrawal_id: int,
    payload: WithdrawalCompleteRequest,
    user: User = Depends(require_role("admin")),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    withdrawal = commit_or_conflict(session, lambda: complete_withdrawal(session, withdrawal_id, user.id, payload.transfer_no))
    session.refresh(withdrawal)
    return {"code": 0, "message": "ok", "data": serialize_withdrawal(withdrawal, include_alipay_account=True)}
