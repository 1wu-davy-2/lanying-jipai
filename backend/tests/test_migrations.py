from pathlib import Path
import hashlib
import re

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
    assert {"primary_storage", "backup_storage"} <= {
        column["name"] for column in inspect(engine).get_columns("media_backup_jobs")
    }


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


def test_script_library_migration_preserves_every_source_document(tmp_path, monkeypatch) -> None:
    database_url = f"sqlite+pysqlite:///{tmp_path / 'script-library.db'}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))

    command.upgrade(config, "head")

    source_directory = Path(__file__).parents[2] / "docs" / "话术"
    expected_documents = {
        "douyin-ops-scripts": ("douyin-ops-scripts.md", 12, 46),
        "recruitment-copy": ("recruitment-copy.md", 11, 33),
        "sensitive-category-scripts": ("sensitive-category-scripts.md", 13, 34),
    }
    engine = create_engine(database_url)
    with engine.connect() as connection:
        assert {"script_categories", "script_documents"} <= set(inspect(engine).get_table_names())
        rows = connection.execute(
            text(
                "SELECT source_key, source_filename, markdown_body, content_sha256, section_count, copy_block_count "
                "FROM script_documents ORDER BY source_key"
            )
        ).mappings().all()

    assert len(rows) == len(expected_documents)
    for row in rows:
        filename, section_count, copy_block_count = expected_documents[row["source_key"]]
        body = (source_directory / filename).read_text(encoding="utf-8")
        assert row["source_filename"] == filename
        assert row["markdown_body"] == body
        assert row["content_sha256"] == hashlib.sha256(body.encode("utf-8")).hexdigest()
        assert row["section_count"] == section_count == len(re.findall(r"(?m)^##\s+", body))
        assert row["copy_block_count"] == copy_block_count == len(re.findall(r"(?s)```(?:\w+)?\s*\r?\n(.*?)\r?\n```", body))
