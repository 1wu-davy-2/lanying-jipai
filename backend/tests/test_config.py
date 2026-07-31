from app.config import Settings, alembic_database_url


def test_alembic_database_url_escapes_configparser_percent_characters(monkeypatch) -> None:
    database_url = (
        "mysql+pymysql://demo:demo%40123456@db.example:3306/jipai?charset=utf8mb4"
    )
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-placeholder")
    monkeypatch.setenv("AES_KEY", "test-aes-placeholder")

    settings = Settings(_env_file=None)

    assert settings.database_url == database_url

    assert alembic_database_url(settings.database_url) == (
        "mysql+pymysql://demo:demo%%40123456@db.example:3306/jipai?charset=utf8mb4"
    )


def test_settings_reads_required_values_from_environment(monkeypatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "mysql+pymysql://lanying_user:password@db.example:3306/lanying_jipai",
    )
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-placeholder")
    monkeypatch.setenv("AES_KEY", "test-aes-placeholder")
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com,https://localhost")

    settings = Settings(_env_file=None)

    assert settings.database_url == (
        "mysql+pymysql://lanying_user:password@db.example:3306/lanying_jipai"
    )
    assert settings.jwt_secret_key == "test-jwt-placeholder"
    assert settings.aes_key == "test-aes-placeholder"
    assert settings.cors_origins == "https://app.example.com,https://localhost"


def test_default_cors_origins_include_vite_development_servers(monkeypatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    settings = Settings(
        _env_file=None,
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret_key="test-jwt-placeholder",
        aes_key="test-aes-placeholder",
    )

    assert "http://localhost:5173" in settings.cors_origins.split(",")
    assert "http://127.0.0.1:5173" in settings.cors_origins.split(",")
