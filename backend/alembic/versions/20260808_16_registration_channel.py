"""Store the acquisition channel selected during registration.

Revision ID: 20260808_16
Revises: 20260807_15
"""

from alembic import op
import sqlalchemy as sa


revision = "20260808_16"
down_revision = "20260807_15"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("registration_channel", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "registration_channel")
