from app.config import Settings


def test_settings_reads_required_values_from_environment(monkeypatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "mysql+pymysql://lanying_user:password@db.example:3306/lanying_jipai",
    )
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-placeholder")
    monkeypatch.setenv("AES_KEY", "test-aes-placeholder")

    settings = Settings(_env_file=None)

    assert settings.database_url == (
        "mysql+pymysql://lanying_user:password@db.example:3306/lanying_jipai"
    )
    assert settings.jwt_secret_key == "test-jwt-placeholder"
    assert settings.aes_key == "test-aes-placeholder"
