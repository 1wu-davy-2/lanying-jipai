import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE, override=False)


def uploads_directory() -> Path:
    configured = Path(os.getenv("UPLOADS_DIR", "uploads")).expanduser()
    return configured if configured.is_absolute() else PROJECT_ROOT / configured


class Settings(BaseSettings):
    """Runtime configuration supplied by the process environment."""

    app_name: str = "Lanying Jipai API"
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://localhost,capacitor://localhost"
    database_url: str
    jwt_secret_key: str
    aes_key: str
    access_token_minutes: int = 30
    refresh_token_days: int = 7
    uploads_dir: str = "uploads"
    upload_storage_driver: str = "local"
    cos_bucket: str | None = None
    cos_region: str | None = None
    cos_secret_id: str | None = None
    cos_secret_key: str | None = None
    cos_public_base_url: str | None = None
    minio_endpoint: str | None = None
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_bucket: str | None = None
    minio_secure: bool = True
    minio_public_base_url: str | None = None
    cos_backup_enabled: bool = False
    media_backup_retry_base_minutes: int = 15

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )
