"""Add independent fulfillment slots for multi-talent orders.

Revision ID: 20260806_14
Revises: 20260805_13
"""

from alembic import context, op
import sqlalchemy as sa


ID_TYPE = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

revision = "20260806_14"
down_revision = "20260805_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "order_fulfillments",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("order_id", ID_TYPE, sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("application_id", ID_TYPE, sa.ForeignKey("order_applications.id"), nullable=False, unique=True),
        sa.Column("model_id", ID_TYPE, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("slot_no", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="CLAIMED"),
        sa.Column("product_source", sa.String(length=30), nullable=False, server_default="merchant_ship"),
        sa.Column("return_required", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("self_keep_after_shoot", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("commission_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("product_subsidy_amount", sa.Numeric(10, 2), nullable=False, server_default="0.00"),
        sa.Column("ship_to_model_tracking_no", sa.String(length=50), nullable=True),
        sa.Column("ship_to_model_company", sa.String(length=50), nullable=True),
        sa.Column("return_tracking_no", sa.String(length=50), nullable=True),
        sa.Column("return_company", sa.String(length=50), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.Column("shipped_at", sa.DateTime(), nullable=True),
        sa.Column("in_progress_at", sa.DateTime(), nullable=True),
        sa.Column("returned_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("order_id", "model_id", name="uq_order_fulfillment_model"),
        sa.UniqueConstraint("order_id", "slot_no", name="uq_order_fulfillment_slot"),
    )
    op.create_index("ix_order_fulfillments_order_id", "order_fulfillments", ["order_id"])
    op.create_index("ix_order_fulfillments_model_id", "order_fulfillments", ["model_id"])
    op.create_index("ix_order_fulfillments_status", "order_fulfillments", ["status"])
    op.create_index("ix_order_fulfillments_order_status", "order_fulfillments", ["order_id", "status"])

    op.create_table(
        "fulfillment_submissions",
        sa.Column("id", ID_TYPE, primary_key=True, autoincrement=True),
        sa.Column("fulfillment_id", ID_TYPE, sa.ForeignKey("order_fulfillments.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING_REVIEW"),
        sa.Column("media_urls", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("remark", sa.Text(), nullable=True),
        sa.Column("review_reason", sa.String(length=255), nullable=True),
        sa.Column("reviewer_id", ID_TYPE, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("fulfillment_id", "version", name="uq_fulfillment_submission_version"),
    )
    op.create_index("ix_fulfillment_submissions_fulfillment_id", "fulfillment_submissions", ["fulfillment_id"])
    op.create_index("ix_fulfillment_submissions_status", "fulfillment_submissions", ["status"])

    _backfill_legacy_orders()


def _backfill_legacy_orders() -> None:
    # Offline SQL export cannot inspect or mutate existing rows. The backfill
    # runs on a live database during normal `alembic upgrade` only.
    if context.is_offline_mode():
        return
    bind = op.get_bind()
    metadata = sa.MetaData()
    orders = sa.Table("orders", metadata, autoload_with=bind)
    applications = sa.Table("order_applications", metadata, autoload_with=bind)
    fulfillments = sa.Table("order_fulfillments", metadata, autoload_with=bind)
    submissions = sa.Table("fulfillment_submissions", metadata, autoload_with=bind)

    rows = bind.execute(sa.select(orders).where(orders.c.model_id.is_not(None))).mappings()
    for order in rows:
        application_id = bind.scalar(
            sa.select(applications.c.id).where(
                applications.c.order_id == order["id"],
                applications.c.model_id == order["model_id"],
            )
        )
        if application_id is None:
            result = bind.execute(
                applications.insert().values(
                    order_id=order["id"],
                    model_id=order["model_id"],
                    status="APPROVED",
                    review_reason="Historical order backfill",
                )
            )
            application_id = result.inserted_primary_key[0]

        existing_id = bind.scalar(sa.select(fulfillments.c.id).where(fulfillments.c.application_id == application_id))
        if existing_id is not None:
            continue

        status = order["status"] if order["status"] != "PUBLISHED" else "CLAIMED"
        result = bind.execute(
            fulfillments.insert().values(
                order_id=order["id"],
                application_id=application_id,
                model_id=order["model_id"],
                slot_no=None if status == "CANCELLED" else 1,
                status=status,
                product_source=order["product_source"],
                return_required=order["return_required"],
                self_keep_after_shoot=order["self_keep_after_shoot"],
                commission_amount=order["commission_amount"],
                product_subsidy_amount=order["product_subsidy_amount"],
                ship_to_model_tracking_no=order["ship_to_model_tracking_no"],
                ship_to_model_company=order["ship_to_model_company"],
                return_tracking_no=order["return_tracking_no"],
                return_company=order["return_company"],
                claimed_at=order["claimed_at"],
                shipped_at=order["shipped_at"],
                in_progress_at=order["in_progress_at"],
                returned_at=order["returned_at"],
                completed_at=order["completed_at"],
                reject_reason=order["reject_reason"],
            )
        )
        fulfillment_id = result.inserted_primary_key[0]
        if order["submitted_media"] and order["submitted_media"] != "[]":
            bind.execute(
                submissions.insert().values(
                    fulfillment_id=fulfillment_id,
                    version=1,
                    status="APPROVED" if order["status"] in {"RETURNED", "COMPLETED"} else "PENDING_REVIEW",
                    media_urls=order["submitted_media"],
                    submitted_at=order["returned_at"] or order["updated_at"],
                )
            )


def downgrade() -> None:
    op.drop_index("ix_fulfillment_submissions_status", table_name="fulfillment_submissions")
    op.drop_index("ix_fulfillment_submissions_fulfillment_id", table_name="fulfillment_submissions")
    op.drop_table("fulfillment_submissions")
    op.drop_index("ix_order_fulfillments_order_status", table_name="order_fulfillments")
    op.drop_index("ix_order_fulfillments_status", table_name="order_fulfillments")
    op.drop_index("ix_order_fulfillments_model_id", table_name="order_fulfillments")
    op.drop_index("ix_order_fulfillments_order_id", table_name="order_fulfillments")
    op.drop_table("order_fulfillments")
