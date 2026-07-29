from __future__ import annotations

from io import BytesIO
from pathlib import Path
from typing import BinaryIO
from urllib.parse import quote

from app.config import Settings, uploads_directory


class StorageConfigurationError(RuntimeError):
    pass


class PrimaryStorageError(RuntimeError):
    pass


class BackupStorageError(RuntimeError):
    pass


def _required(value: str | None, name: str) -> str:
    if not value:
        raise StorageConfigurationError(f"Missing required storage setting: {name}")
    return value


class LocalMediaStorage:
    primary_storage = "local"
    backup_storage: str | None = None
    backup_enabled = False

    def upload_primary(self, object_key: str, content: bytes, content_type: str) -> str:
        target = uploads_directory() / Path(object_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        return f"/uploads/{quote(object_key, safe='/')}"


class MinioCosMediaStorage:
    primary_storage = "minio"

    def __init__(self, settings: Settings, require_backup: bool = False) -> None:
        self.settings = settings
        self._require_backup = require_backup
        self._validate_configuration()
        self._minio_client = self._create_minio_client()
        self._cos_client = self._create_cos_client() if self.backup_enabled else None

    @property
    def backup_enabled(self) -> bool:
        return self.settings.cos_backup_enabled or self._require_backup

    @property
    def backup_storage(self) -> str | None:
        return "cos" if self.backup_enabled else None

    def _validate_configuration(self) -> None:
        _required(self.settings.minio_endpoint, "MINIO_ENDPOINT")
        _required(self.settings.minio_access_key, "MINIO_ACCESS_KEY")
        _required(self.settings.minio_secret_key, "MINIO_SECRET_KEY")
        _required(self.settings.minio_bucket, "MINIO_BUCKET")
        _required(self.settings.minio_public_base_url, "MINIO_PUBLIC_BASE_URL")
        if self.backup_enabled:
            _required(self.settings.cos_bucket, "COS_BUCKET")
            _required(self.settings.cos_region, "COS_REGION")
            _required(self.settings.cos_secret_id, "COS_SECRET_ID")
            _required(self.settings.cos_secret_key, "COS_SECRET_KEY")

    def _create_minio_client(self):
        try:
            from minio import Minio
        except ImportError as exc:
            raise StorageConfigurationError("minio is not installed") from exc

        try:
            return Minio(
                _required(self.settings.minio_endpoint, "MINIO_ENDPOINT"),
                access_key=_required(self.settings.minio_access_key, "MINIO_ACCESS_KEY"),
                secret_key=_required(self.settings.minio_secret_key, "MINIO_SECRET_KEY"),
                secure=self.settings.minio_secure,
            )
        except Exception as exc:
            raise StorageConfigurationError("MinIO client configuration is invalid") from exc

    def _create_cos_client(self):
        try:
            from qcloud_cos import CosConfig, CosS3Client
        except ImportError as exc:
            raise StorageConfigurationError("cos-python-sdk-v5 is not installed") from exc

        try:
            config = CosConfig(
                Region=_required(self.settings.cos_region, "COS_REGION"),
                SecretId=_required(self.settings.cos_secret_id, "COS_SECRET_ID"),
                SecretKey=_required(self.settings.cos_secret_key, "COS_SECRET_KEY"),
                Scheme="https",
            )
            return CosS3Client(config)
        except Exception as exc:
            raise StorageConfigurationError("COS client configuration is invalid") from exc

    def upload_primary(self, object_key: str, content: bytes, content_type: str) -> str:
        try:
            self._minio_client.put_object(
                _required(self.settings.minio_bucket, "MINIO_BUCKET"),
                object_key,
                BytesIO(content),
                len(content),
                content_type=content_type,
            )
        except Exception as exc:
            raise PrimaryStorageError("MinIO upload failed") from exc
        return self.public_url(object_key)

    def backup_content(self, object_key: str, content: bytes, content_type: str) -> None:
        if self._cos_client is None:
            raise BackupStorageError("COS backup is disabled")
        try:
            self._cos_client.put_object(
                Bucket=_required(self.settings.cos_bucket, "COS_BUCKET"),
                Key=object_key,
                Body=content,
                ContentType=content_type,
            )
        except Exception as exc:
            raise BackupStorageError("COS backup upload failed") from exc

    def fetch_primary(self, object_key: str) -> bytes:
        try:
            response = self._minio_client.get_object(
                _required(self.settings.minio_bucket, "MINIO_BUCKET"),
                object_key,
            )
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()
        except Exception as exc:
            raise PrimaryStorageError("MinIO download failed") from exc

    def public_url(self, object_key: str) -> str:
        base_url = _required(self.settings.minio_public_base_url, "MINIO_PUBLIC_BASE_URL")
        return f"{base_url.rstrip('/')}/{quote(object_key, safe='/')}"


class CosMinioMediaStorage:
    primary_storage = "cos"
    backup_storage = "minio"
    backup_enabled = True

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self._validate_configuration()
        self._cos_client = self._create_cos_client()
        self._minio_client = self._create_minio_client()

    def _validate_configuration(self) -> None:
        _required(self.settings.cos_bucket, "COS_BUCKET")
        _required(self.settings.cos_region, "COS_REGION")
        _required(self.settings.cos_secret_id, "COS_SECRET_ID")
        _required(self.settings.cos_secret_key, "COS_SECRET_KEY")
        _required(self.settings.minio_endpoint, "MINIO_ENDPOINT")
        _required(self.settings.minio_access_key, "MINIO_ACCESS_KEY")
        _required(self.settings.minio_secret_key, "MINIO_SECRET_KEY")
        _required(self.settings.minio_bucket, "MINIO_BUCKET")

    def _create_cos_client(self):
        try:
            from qcloud_cos import CosConfig, CosS3Client
        except ImportError as exc:
            raise StorageConfigurationError("cos-python-sdk-v5 is not installed") from exc

        try:
            config = CosConfig(
                Region=_required(self.settings.cos_region, "COS_REGION"),
                SecretId=_required(self.settings.cos_secret_id, "COS_SECRET_ID"),
                SecretKey=_required(self.settings.cos_secret_key, "COS_SECRET_KEY"),
                Scheme="https",
            )
            return CosS3Client(config)
        except Exception as exc:
            raise StorageConfigurationError("COS client configuration is invalid") from exc

    def _create_minio_client(self):
        try:
            from minio import Minio
        except ImportError as exc:
            raise StorageConfigurationError("minio is not installed") from exc

        try:
            return Minio(
                _required(self.settings.minio_endpoint, "MINIO_ENDPOINT"),
                access_key=_required(self.settings.minio_access_key, "MINIO_ACCESS_KEY"),
                secret_key=_required(self.settings.minio_secret_key, "MINIO_SECRET_KEY"),
                secure=self.settings.minio_secure,
            )
        except Exception as exc:
            raise StorageConfigurationError("MinIO client configuration is invalid") from exc

    def upload_primary(self, object_key: str, content: bytes, content_type: str) -> str:
        try:
            self._cos_client.put_object(
                Bucket=_required(self.settings.cos_bucket, "COS_BUCKET"),
                Key=object_key,
                Body=content,
                ContentType=content_type,
            )
        except Exception as exc:
            raise PrimaryStorageError("COS upload failed") from exc
        return self.public_url(object_key)

    def backup_content(self, object_key: str, content: bytes, content_type: str) -> None:
        try:
            self._minio_client.put_object(
                _required(self.settings.minio_bucket, "MINIO_BUCKET"),
                object_key,
                BytesIO(content),
                len(content),
                content_type=content_type,
            )
        except Exception as exc:
            raise BackupStorageError("MinIO backup upload failed") from exc

    def fetch_primary(self, object_key: str) -> bytes:
        try:
            response = self._cos_client.get_object(
                Bucket=_required(self.settings.cos_bucket, "COS_BUCKET"),
                Key=object_key,
            )
            stream: BinaryIO = response["Body"].get_raw_stream()
            try:
                return stream.read()
            finally:
                stream.close()
        except Exception as exc:
            raise PrimaryStorageError("COS download failed") from exc

    def public_url(self, object_key: str) -> str:
        base_url = self.settings.cos_public_base_url
        if not base_url:
            bucket = _required(self.settings.cos_bucket, "COS_BUCKET")
            region = _required(self.settings.cos_region, "COS_REGION")
            base_url = f"https://{bucket}.cos.{region}.myqcloud.com"
        return f"{base_url.rstrip('/')}/{quote(object_key, safe='/')}"


def get_media_storage() -> LocalMediaStorage | MinioCosMediaStorage | CosMinioMediaStorage:
    settings = Settings()
    driver = settings.upload_storage_driver.lower().strip()
    if driver == "local":
        return LocalMediaStorage()
    if driver == "minio":
        return MinioCosMediaStorage(settings)
    if driver == "cos":
        return CosMinioMediaStorage(settings)
    raise StorageConfigurationError("UPLOAD_STORAGE_DRIVER must be local, minio, or cos")


def get_storage_for_backup(
    primary_storage: str,
    backup_storage: str,
) -> MinioCosMediaStorage | CosMinioMediaStorage:
    settings = Settings()
    if (primary_storage, backup_storage) == ("minio", "cos"):
        return MinioCosMediaStorage(settings, require_backup=True)
    if (primary_storage, backup_storage) == ("cos", "minio"):
        return CosMinioMediaStorage(settings)
    raise StorageConfigurationError(
        f"Unsupported media backup direction: {primary_storage} -> {backup_storage}"
    )
