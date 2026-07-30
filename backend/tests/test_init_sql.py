import subprocess
import sys
from pathlib import Path


def test_mariadb_init_sql_export_contains_schema_and_seed_data(tmp_path) -> None:
    backend_root = Path(__file__).parents[1]
    output = tmp_path / "init-mariadb.sql"

    result = subprocess.run(
        [sys.executable, "-m", "scripts.export_mariadb_init_sql", "--output", str(output)],
        cwd=backend_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )

    assert result.returncode == 0, result.stderr
    sql = output.read_text(encoding="utf-8")
    assert "CREATE TABLE users" in sql
    assert "CREATE TABLE order_applications" in sql
    assert "order_id BIGINT NOT NULL" in sql
    assert "model_id BIGINT NOT NULL" in sql
    assert "reviewer_id BIGINT" in sql
    assert "CREATE TABLE script_documents" in sql
    assert "1111111112" in sql
    assert "超级管理员" in sql
    assert "platform_name" in sql
    assert "抖音运营话术库" in sql
    assert "UPDATE alembic_version SET version_num='20260804_12'" in sql

    tracked_sql = (backend_root / "sql" / "init-mariadb.sql").read_text(encoding="utf-8")
    assert tracked_sql == sql
    for required_fragment in (
        "SET NAMES utf8mb4",
        "CREATE TABLE users",
        "CREATE TABLE script_documents",
        "1111111112",
        "talent_portfolio_min_count",
        "UPDATE alembic_version SET version_num='20260804_12'",
    ):
        assert required_fragment in tracked_sql
