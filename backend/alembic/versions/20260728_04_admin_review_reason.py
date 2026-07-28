"""Add verification review reason.

Revision ID: 20260728_04
Revises: 20260728_03
Create Date: 2026-07-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_04"
down_revision: str | None = "20260728_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("verify_reject_reason", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "verify_reject_reason")
