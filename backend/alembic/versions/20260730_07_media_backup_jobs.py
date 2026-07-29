"""Add media backup jobs.

Revision ID: 20260730_07
Revises: 20260729_06
Create Date: 2026-07-30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260730_07"
down_revision: str | None = "20260729_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "media_backup_jobs",
        sa.Column("id", sa.BigInteger().with_variant(sa.Integer(), "sqlite"), primary_key=True, autoincrement=True),
        sa.Column("object_key", sa.String(length=512), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("content_size", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_attempt_at", sa.DateTime(), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(), nullable=True),
        sa.Column("synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_media_backup_jobs_object_key", "media_backup_jobs", ["object_key"])
    op.create_index("ix_media_backup_jobs_status", "media_backup_jobs", ["status"])
    op.create_index("ix_media_backup_jobs_next_retry_at", "media_backup_jobs", ["next_retry_at"])


def downgrade() -> None:
    op.drop_index("ix_media_backup_jobs_next_retry_at", table_name="media_backup_jobs")
    op.drop_index("ix_media_backup_jobs_status", table_name="media_backup_jobs")
    op.drop_index("ix_media_backup_jobs_object_key", table_name="media_backup_jobs")
    op.drop_table("media_backup_jobs")
