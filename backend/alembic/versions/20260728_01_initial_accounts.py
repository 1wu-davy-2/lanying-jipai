"""Create users and role profile tables.

Revision ID: 20260728_01
Revises:
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamp_columns() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    ]


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("merchant", "model", "admin", name="user_role"), nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("avatar_url", sa.String(length=255), nullable=True),
        sa.Column("status", sa.Enum("active", "disabled", name="user_status"), nullable=False, server_default="active"),
        sa.Column("real_name", sa.String(length=50), nullable=True),
        sa.Column("id_card_no", sa.String(length=255), nullable=True),
        sa.Column("alipay_account", sa.String(length=100), nullable=True),
        sa.Column("alipay_real_name", sa.String(length=50), nullable=True),
        sa.Column(
            "verify_status",
            sa.Enum("unverified", "pending", "verified", "rejected", name="verify_status"),
            nullable=False,
            server_default="unverified",
        ),
        *timestamp_columns(),
        sa.UniqueConstraint("phone", name="uq_users_phone"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_users_phone", "users", ["phone"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])
    op.create_table(
        "merchant_profiles",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("shop_name", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("shop_platform", sa.String(length=50), nullable=True),
        sa.Column("contact_phone", sa.String(length=20), nullable=False, server_default=""),
        sa.Column("default_ship_address", sa.String(length=255), nullable=False, server_default=""),
        *timestamp_columns(),
        sa.UniqueConstraint("user_id", name="uq_merchant_profiles_user_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_table(
        "model_profiles",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("height_cm", sa.SmallInteger(), nullable=True),
        sa.Column("weight_kg", sa.SmallInteger(), nullable=True),
        sa.Column("shoe_size", sa.String(length=10), nullable=True),
        sa.Column("skill_tags", sa.String(length=255), nullable=True),
        sa.Column("receive_address", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("portfolio_urls", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.UniqueConstraint("user_id", name="uq_model_profiles_user_id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )


def downgrade() -> None:
    op.drop_table("model_profiles")
    op.drop_table("merchant_profiles")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")
