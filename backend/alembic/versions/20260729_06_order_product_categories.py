"""Add product categories to orders.

Revision ID: 20260729_06
Revises: 20260728_05
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260729_06"
down_revision: str | None = "20260728_05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("product_categories", sa.String(length=255), nullable=False, server_default='["其他"]'),
    )


def downgrade() -> None:
    op.drop_column("orders", "product_categories")
