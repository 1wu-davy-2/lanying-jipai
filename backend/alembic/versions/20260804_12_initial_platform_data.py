"""Seed production-safe platform defaults for a fresh database.

Revision ID: 20260804_12
Revises: 20260803_11
"""

from alembic import op


revision = "20260804_12"
down_revision = "20260803_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Conditional inserts keep upgrades safe for databases where the API bootstrap
    # has already created the administrator before this migration was introduced.
    op.execute(
        """
        INSERT INTO users (phone, password_hash, role, nickname)
        SELECT '1111111112', '$2b$12$6Oh.KUfvzK6jVUNXVUGFr.uM0nEGo1DE1FYDft/meK/uF/gbQu.A6', 'admin', '超级管理员'
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE phone = '1111111112')
        """
    )
    op.execute(
        """
        INSERT INTO platform_configs (config_key, config_value, description)
        SELECT 'platform_name', '蓝鹰寄拍', '平台显示名称'
        WHERE NOT EXISTS (SELECT 1 FROM platform_configs WHERE config_key = 'platform_name')
        """
    )
    op.execute(
        """
        INSERT INTO platform_configs (config_key, config_value, description)
        SELECT 'talent_portfolio_min_count', '6', '达人接单资料要求的最少作品照片数量'
        WHERE NOT EXISTS (SELECT 1 FROM platform_configs WHERE config_key = 'talent_portfolio_min_count')
        """
    )


def downgrade() -> None:
    # Initial data may already be in active use. Do not delete an administrator
    # or platform settings merely because an application rollback is requested.
    pass
