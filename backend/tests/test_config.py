from app.config import Settings


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
