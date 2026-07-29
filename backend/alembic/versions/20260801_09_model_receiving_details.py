"""Store detailed receiving details for talent profiles.

Revision ID: 20260801_09
Revises: 20260731_08
Create Date: 2026-08-01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260801_09"
down_revision: str | None = "20260731_08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("model_profiles", sa.Column("receiver_name", sa.String(length=50), nullable=False, server_default=""))
    op.add_column("model_profiles", sa.Column("receiver_phone", sa.String(length=20), nullable=False, server_default=""))
    op.add_column("model_profiles", sa.Column("receive_address_detail", sa.String(length=255), nullable=False, server_default=""))


def downgrade() -> None:
    op.drop_column("model_profiles", "receive_address_detail")
    op.drop_column("model_profiles", "receiver_phone")
    op.drop_column("model_profiles", "receiver_name")
