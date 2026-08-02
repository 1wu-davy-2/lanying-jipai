"""Scope order messages to individual multi-talent fulfillments.

Revision ID: 20260807_15
Revises: 20260806_14
"""

from alembic import op
import sqlalchemy as sa


ID_TYPE = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

revision = "20260807_15"
down_revision = "20260806_14"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing parent-order conversations are represented by NULL.  The
    # nullable foreign key lets old clients and historical rows continue to
    # use the legacy /orders/{order_id}/messages endpoints unchanged.
    with op.batch_alter_table("order_messages") as batch:
        batch.add_column(
            sa.Column(
                "fulfillment_id",
                ID_TYPE,
                sa.ForeignKey("order_fulfillments.id", name="fk_order_messages_fulfillment_id"),
                nullable=True,
            )
        )
        batch.create_index("ix_order_messages_fulfillment_id", ["fulfillment_id"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("order_messages") as batch:
        batch.drop_index("ix_order_messages_fulfillment_id")
        batch.drop_column("fulfillment_id")
