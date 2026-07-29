from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from app.database import get_session_factory
from app.main import app
from app.models.media import MediaBackupJob
from app.services import media_backup
from app.services.media_storage import StorageConfigurationError, get_media_storage


def register(client: TestClient, phone: str) -> str:
    response = client.post(
        "/api/auth/register",
        json={"phone": phone, "password": "secure-password", "role": "merchant"},
    )
    return response.json()["data"]["access_token"]


def valid_png() -> bytes:
    image_buffer = BytesIO()
    Image.new("RGB", (1, 1), "white").save(image_buffer, format="PNG")
    return image_buffer.getvalue()


class FakeCosMinioStorage:
    backup_enabled = True

    def __init__(self, fail_backup: bool = False) -> None:
        self.fail_backup = fail_backup
        self.primary: dict[str, bytes] = {}
        self.backups: dict[str, bytes] = {}

    def upload_primary(self, object_key: str, content: bytes, content_type: str) -> str:
        self.primary[object_key] = content
        return f"https://media.example.com/{object_key}"

    def backup_content(self, object_key: str, content: bytes, content_type: str) -> None:
        if self.fail_backup:
            raise RuntimeError("MinIO is unavailable")
        self.backups[object_key] = content

    def fetch_primary(self, object_key: str) -> bytes:
        return self.primary[object_key]


def test_cos_storage_rejects_incomplete_configuration(monkeypatch) -> None:
    monkeypatch.setenv("UPLOAD_STORAGE_DRIVER", "cos")
    for name in (
        "COS_BUCKET",
        "COS_REGION",
        "COS_SECRET_ID",
        "COS_SECRET_KEY",
        "MINIO_ENDPOINT",
        "MINIO_ACCESS_KEY",
        "MINIO_SECRET_KEY",
        "MINIO_BUCKET",
    ):
        monkeypatch.delenv(name, raising=False)

    try:
        get_media_storage()
    except StorageConfigurationError as exc:
        assert "COS_BUCKET" in str(exc)
    else:
        raise AssertionError("incomplete COS configuration must be rejected")


def test_cos_upload_returns_public_url_and_syncs_minio(monkeypatch) -> None:
    from app.routers import uploads as uploads_router

    storage = FakeCosMinioStorage()
    monkeypatch.setattr(uploads_router, "get_media_storage", lambda: storage)
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {register(client, '13300000009')}"}

    response = client.post("/api/uploads", headers=headers, files={"file": ("sample.png", valid_png(), "image/png")})

    assert response.status_code == 201
    url = response.json()["data"]["url"]
    assert url.startswith("https://media.example.com/")
    object_key = url.removeprefix("https://media.example.com/")
    assert storage.backups[object_key] == storage.primary[object_key]

    session = get_session_factory()()
    try:
        job = session.query(MediaBackupJob).one()
        assert job.object_key == object_key
        assert job.status == "SYNCED"
        assert job.attempt_count == 1
    finally:
        session.close()


def test_minio_failure_keeps_cos_upload_and_queues_retry(monkeypatch) -> None:
    from app.routers import uploads as uploads_router

    storage = FakeCosMinioStorage(fail_backup=True)
    monkeypatch.setattr(uploads_router, "get_media_storage", lambda: storage)
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {register(client, '13300000010')}"}

    response = client.post("/api/uploads", headers=headers, files={"file": ("sample.png", valid_png(), "image/png")})

    assert response.status_code == 201
    assert response.json()["data"]["url"].startswith("https://media.example.com/")
    session = get_session_factory()()
    try:
        job = session.query(MediaBackupJob).one()
        assert job.status == "PENDING"
        assert job.attempt_count == 1
        assert job.next_retry_at is not None
        assert "MinIO is unavailable" in job.last_error
    finally:
        session.close()


def test_pending_backup_is_retried_from_cos(monkeypatch) -> None:
    storage = FakeCosMinioStorage()
    storage.primary["2026/07/retry.png"] = b"content"
    monkeypatch.setattr(media_backup, "get_media_storage", lambda: storage)
    session = get_session_factory()()
    try:
        session.add(
            MediaBackupJob(
                object_key="2026/07/retry.png",
                content_type="image/png",
                content_size=7,
                status="PENDING",
            )
        )
        session.commit()

        synced, failed = media_backup.retry_pending_backups(session, force=True)

        assert (synced, failed) == (1, 0)
        job = session.query(MediaBackupJob).one()
        assert job.status == "SYNCED"
        assert storage.backups[job.object_key] == b"content"
    finally:
        session.close()
