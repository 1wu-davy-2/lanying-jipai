"""Add marketplace requirements and order applications.

Revision ID: 20260802_10
Revises: 20260801_09
"""

from alembic import op
import sqlalchemy as sa


revision = "20260802_10"
down_revision = "20260801_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("order_type", sa.String(length=30), nullable=False, server_default="product_photo"))
        batch.add_column(sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("required_media_count", sa.Integer(), nullable=False, server_default="6"))
        batch.add_column(sa.Column("delivery_days", sa.Integer(), nullable=False, server_default="5"))
        batch.add_column(sa.Column("deposit_required", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("return_required", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.create_table(
        "order_applications",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("model_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("message", sa.String(length=300), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("reviewer_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("review_reason", sa.String(length=255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("order_id", "model_id", name="uq_order_application_model"),
    )
    op.create_index("ix_order_applications_order_id", "order_applications", ["order_id"])
    op.create_index("ix_order_applications_model_id", "order_applications", ["model_id"])
    op.create_index("ix_order_applications_status", "order_applications", ["status"])


def downgrade() -> None:
    op.drop_index("ix_order_applications_status", table_name="order_applications")
    op.drop_index("ix_order_applications_model_id", table_name="order_applications")
    op.drop_index("ix_order_applications_order_id", table_name="order_applications")
    op.drop_table("order_applications")
    with op.batch_alter_table("orders") as batch:
        batch.drop_column("return_required")
        batch.drop_column("deposit_required")
        batch.drop_column("delivery_days")
        batch.drop_column("required_media_count")
        batch.drop_column("quantity")
        batch.drop_column("order_type")
