"""Track media backup storage directions.

Revision ID: 20260731_08
Revises: 20260730_07
Create Date: 2026-07-31
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260731_08"
down_revision: str | None = "20260730_07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "media_backup_jobs",
        sa.Column("primary_storage", sa.String(length=20), nullable=False, server_default="cos"),
    )
    op.add_column(
        "media_backup_jobs",
        sa.Column("backup_storage", sa.String(length=20), nullable=False, server_default="minio"),
    )


def downgrade() -> None:
    op.drop_column("media_backup_jobs", "backup_storage")
    op.drop_column("media_backup_jobs", "primary_storage")
