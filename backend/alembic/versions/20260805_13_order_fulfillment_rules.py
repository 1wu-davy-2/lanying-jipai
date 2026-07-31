"""Add order fulfillment rules, merchant assurances, and uploaded media metadata.

Revision ID: 20260805_13
Revises: 20260804_12
"""

from alembic import op
import sqlalchemy as sa


ID_TYPE = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

revision = "20260805_13"
down_revision = "20260804_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("orders") as batch:
        batch.add_column(sa.Column("product_source", sa.String(length=30), nullable=False, server_default="merchant_ship"))
        batch.add_column(sa.Column("product_subsidy_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
        batch.add_column(sa.Column("self_keep_after_shoot", sa.Boolean(), nullable=False, server_default=sa.false()))
    with op.batch_alter_table("order_applications") as batch:
        batch.add_column(sa.Column("owned_product_images", sa.Text(), nullable=True))
    with op.batch_alter_table("merchant_profiles") as batch:
        batch.add_column(sa.Column("quality_merchant", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("guarantee_deposit_paid", sa.Boolean(), nullable=False, server_default=sa.false()))
        batch.add_column(sa.Column("guarantee_deposit_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"))
    op.create_table(
        "media_assets",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("owner_id", ID_TYPE, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("url", sa.String(length=512), nullable=False, unique=True),
        sa.Column("content_type", sa.String(length=100), nullable=False),
        sa.Column("duration_seconds", sa.Numeric(10, 3), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_media_assets_owner_id", "media_assets", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_media_assets_owner_id", table_name="media_assets")
    op.drop_table("media_assets")
    with op.batch_alter_table("merchant_profiles") as batch:
        batch.drop_column("guarantee_deposit_amount")
        batch.drop_column("guarantee_deposit_paid")
        batch.drop_column("quality_merchant")
    with op.batch_alter_table("order_applications") as batch:
        batch.drop_column("owned_product_images")
    with op.batch_alter_table("orders") as batch:
        batch.drop_column("self_keep_after_shoot")
        batch.drop_column("product_subsidy_amount")
        batch.drop_column("product_source")
