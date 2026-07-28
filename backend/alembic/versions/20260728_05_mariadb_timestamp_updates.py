"""Apply MariaDB ON UPDATE timestamp defaults.

Revision ID: 20260728_05
Revises: 20260728_04
Create Date: 2026-07-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260728_05"
down_revision: str | None = "20260728_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("users", "merchant_profiles", "model_profiles", "orders", "wallets", "withdrawals", "platform_configs")


def upgrade() -> None:
    if op.get_bind().dialect.name != "mysql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} MODIFY updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")


def downgrade() -> None:
    if op.get_bind().dialect.name != "mysql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} MODIFY updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
