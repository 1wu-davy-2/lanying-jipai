"""Create wallet, transaction, withdrawal, and platform config tables.

Revision ID: 20260728_03
Revises: 20260728_02
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

SQLITE_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

revision: str = "20260728_03"
down_revision: str | None = "20260728_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    ]


def upgrade() -> None:
    withdrawal_status = sa.Enum("pending", "approved", "rejected", "completed", name="withdrawal_status")
    transaction_type = sa.Enum(
        "order_settlement", "withdrawal_freeze", "withdrawal_complete", "withdrawal_reject_refund", name="wallet_transaction_type"
    )
    op.create_table(
        "wallets",
        sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
        sa.Column("user_id", SQLITE_BIGINT, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("available_balance", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("frozen_balance", sa.Numeric(10, 2), nullable=False, server_default="0"),
        *timestamp_columns(),
        sa.CheckConstraint("available_balance >= 0", name="ck_wallets_available_nonnegative"),
        sa.CheckConstraint("frozen_balance >= 0", name="ck_wallets_frozen_nonnegative"),
        sa.UniqueConstraint("user_id", name="uq_wallets_user_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_table(
        "withdrawals",
        sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
        sa.Column("withdrawal_no", sa.String(length=32), nullable=False),
        sa.Column("user_id", SQLITE_BIGINT, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("alipay_account", sa.String(length=255), nullable=False),
        sa.Column("alipay_real_name", sa.String(length=50), nullable=False),
        sa.Column("status", withdrawal_status, nullable=False, server_default="pending"),
        sa.Column("reviewer_id", SQLITE_BIGINT, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reject_reason", sa.String(length=255), nullable=True),
        sa.Column("transfer_no", sa.String(length=100), nullable=True),
        sa.Column("transferred_at", sa.DateTime(), nullable=True),
        sa.Column("remark", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.CheckConstraint("amount > 0", name="ck_withdrawals_amount_positive"),
        sa.UniqueConstraint("withdrawal_no", name="uq_withdrawals_withdrawal_no"),
        sa.UniqueConstraint("transfer_no", name="uq_withdrawals_transfer_no"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_withdrawals_user_created", "withdrawals", ["user_id", "created_at"])
    op.create_index("idx_withdrawals_status_created", "withdrawals", ["status", "created_at"])
    op.create_table(
        "wallet_transactions",
        sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
        sa.Column("idempotency_key", sa.String(length=100), nullable=False),
        sa.Column("user_id", SQLITE_BIGINT, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", transaction_type, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(10, 2), nullable=False),
        sa.Column("frozen_balance_after", sa.Numeric(10, 2), nullable=False),
        sa.Column("order_id", SQLITE_BIGINT, sa.ForeignKey("orders.id"), nullable=True),
        sa.Column("withdrawal_id", SQLITE_BIGINT, sa.ForeignKey("withdrawals.id"), nullable=True),
        sa.Column("remark", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("idempotency_key", name="uq_wallet_transactions_idempotency_key"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_wallet_transactions_user_created", "wallet_transactions", ["user_id", "created_at"])
    op.create_index("idx_wallet_transactions_order_id", "wallet_transactions", ["order_id"])
    op.create_index("idx_wallet_transactions_withdrawal_id", "wallet_transactions", ["withdrawal_id"])
    op.create_table(
        "platform_configs",
        sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
        sa.Column("config_key", sa.String(length=50), nullable=False),
        sa.Column("config_value", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        *timestamp_columns(),
        sa.UniqueConstraint("config_key", name="uq_platform_configs_config_key"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    op.drop_table("platform_configs")
    op.drop_index("idx_wallet_transactions_withdrawal_id", table_name="wallet_transactions")
    op.drop_index("idx_wallet_transactions_order_id", table_name="wallet_transactions")
    op.drop_index("idx_wallet_transactions_user_created", table_name="wallet_transactions")
    op.drop_table("wallet_transactions")
    op.drop_index("idx_withdrawals_status_created", table_name="withdrawals")
    op.drop_index("idx_withdrawals_user_created", table_name="withdrawals")
    op.drop_table("withdrawals")
    op.drop_table("wallets")
