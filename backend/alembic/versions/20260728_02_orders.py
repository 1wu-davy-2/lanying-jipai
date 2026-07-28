"""Create order, order log, and message tables.

Revision ID: 20260728_02
Revises: 20260728_01
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_02"
down_revision: str | None = "20260728_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    ]


def upgrade() -> None:
    order_status = sa.Enum(
        "DRAFT", "PUBLISHED", "CLAIMED", "SHIPPED_TO_MODEL", "IN_PROGRESS", "RETURNED", "COMPLETED", "DISPUTED", "CANCELLED", name="order_status"
    )
    op.create_table(
        "orders",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("order_no", sa.String(length=32), nullable=False),
        sa.Column("merchant_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("model_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("title", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("sample_images", sa.Text(), nullable=True),
        sa.Column("commission_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("shoot_requirements", sa.Text(), nullable=True),
        sa.Column("status", order_status, nullable=False, server_default="PUBLISHED"),
        sa.Column("ship_to_model_tracking_no", sa.String(length=50), nullable=True),
        sa.Column("ship_to_model_company", sa.String(length=50), nullable=True),
        sa.Column("return_tracking_no", sa.String(length=50), nullable=True),
        sa.Column("return_company", sa.String(length=50), nullable=True),
        sa.Column("submitted_media", sa.Text(), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        sa.Column("in_progress_at", sa.DateTime(), nullable=True),
        sa.Column("returned_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        *timestamp_columns(),
        sa.UniqueConstraint("order_no", name="uq_orders_order_no"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_orders_status", "orders", ["status"])
    op.create_index("idx_orders_merchant_id", "orders", ["merchant_id"])
    op.create_index("idx_orders_model_id", "orders", ["model_id"])
    op.create_table(
        "order_logs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("operator_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("from_status", sa.String(length=30), nullable=True),
        sa.Column("to_status", sa.String(length=30), nullable=False),
        sa.Column("remark", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_order_logs_order_id", "order_logs", ["order_id"])
    op.create_table(
        "order_messages",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.BigInteger(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("sender_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("idx_order_messages_order_id", "order_messages", ["order_id"])


def downgrade() -> None:
    op.drop_index("idx_order_messages_order_id", table_name="order_messages")
    op.drop_table("order_messages")
    op.drop_index("idx_order_logs_order_id", table_name="order_logs")
    op.drop_table("order_logs")
    op.drop_index("idx_orders_model_id", table_name="orders")
    op.drop_index("idx_orders_merchant_id", table_name="orders")
    op.drop_index("idx_orders_status", table_name="orders")
    op.drop_table("orders")
