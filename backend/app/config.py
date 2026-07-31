import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.app_release import AndroidReleaseManifest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
load_dotenv(ENV_FILE, override=False)


def uploads_directory() -> Path:
    configured = Path(os.getenv("UPLOADS_DIR", "uploads")).expanduser()
    return configured if configured.is_absolute() else PROJECT_ROOT / configured


def alembic_database_url(database_url: str) -> str:
    """Escape percent characters at Alembic's ConfigParser boundary."""
    return database_url.replace("%", "%%")


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
    android_update_version_code: int = 0
    android_update_version_name: str | None = None
    android_update_apk_url: str | None = None
    android_update_apk_sha256: str | None = None
    android_update_release_notes: str | None = None
    bootstrap_admin_enabled: bool = True
    bootstrap_admin_phone: str = "1111111112"
    bootstrap_admin_password: str = "admin@123"
    bootstrap_admin_nickname: str = "超级管理员"

    @model_validator(mode="after")
    def validate_enabled_android_update(self) -> "Settings":
        if self.android_update_version_code <= 0:
            return self

        AndroidReleaseManifest(
            version_code=self.android_update_version_code,
            version_name=self.android_update_version_name,
            release_notes=self.android_update_release_notes,
            apk_url=self.android_update_apk_url,
            apk_sha256=self.android_update_apk_sha256,
        )
        return self

    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )
