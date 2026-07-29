from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.dialects import mysql


def test_initial_migration_creates_account_tables(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'migration.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    assert {
        "users",
        "merchant_profiles",
        "model_profiles",
        "orders",
        "order_logs",
        "order_messages",
        "wallets",
        "wallet_transactions",
        "withdrawals",
        "platform_configs",
        "media_backup_jobs",
    } <= set(inspect(engine).get_table_names())
    assert "product_categories" in {column["name"] for column in inspect(engine).get_columns("orders")}


def test_sqlite_migrations_generate_primary_keys(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'migration-primary-key.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (phone, password_hash, role, nickname) "
                "VALUES (:phone, :password_hash, :role, :nickname)"
            ),
            {
                "phone": "13000000000",
                "password_hash": "hash",
                "role": "merchant",
                "nickname": "SQLite migration test",
            },
        )
        user_id = connection.scalar(text("SELECT id FROM users WHERE phone = :phone"), {"phone": "13000000000"})

    assert user_id == 1


def test_orm_identifiers_match_mariadb_bigint_migrations() -> None:
    from app.models.media import MediaBackupJob
    from app.models.order import Order, OrderLog, OrderMessage
    from app.models.user import MerchantProfile, ModelProfile, User
    from app.models.wallet import PlatformConfig, Wallet, WalletTransaction, Withdrawal

    for model in (User, MerchantProfile, ModelProfile, Order, OrderLog, OrderMessage, Wallet, WalletTransaction, Withdrawal, PlatformConfig, MediaBackupJob):
        assert model.__table__.c.id.type.compile(dialect=mysql.dialect()) == "BIGINT"
