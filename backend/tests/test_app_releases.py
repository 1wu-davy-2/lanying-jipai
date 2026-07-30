import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.config import Settings
from app.main import app


def test_latest_android_release_returns_empty_success_when_disabled(monkeypatch) -> None:
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_CODE", "0")
    monkeypatch.delenv("ANDROID_UPDATE_VERSION_NAME", raising=False)
    monkeypatch.delenv("ANDROID_UPDATE_APK_URL", raising=False)
    monkeypatch.delenv("ANDROID_UPDATE_APK_SHA256", raising=False)
    monkeypatch.delenv("ANDROID_UPDATE_RELEASE_NOTES", raising=False)

    response = TestClient(app).get("/api/app-releases/android/latest")

    assert response.status_code == 200
    assert response.json() == {"code": 0, "message": "ok", "data": None}


def test_latest_android_release_returns_forced_manifest(monkeypatch) -> None:
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_CODE", "2")
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_NAME", "1.1.0")
    monkeypatch.setenv(
        "ANDROID_UPDATE_APK_URL",
        "https://app.example.com/releases/lanying-jipai-1.1.0.apk",
    )
    monkeypatch.setenv("ANDROID_UPDATE_APK_SHA256", "a" * 64)
    monkeypatch.setenv("ANDROID_UPDATE_RELEASE_NOTES", "Security and stability improvements.")

    response = TestClient(app).get("/api/app-releases/android/latest")

    assert response.status_code == 200
    assert response.json() == {
        "code": 0,
        "message": "ok",
        "data": {
            "platform": "android",
            "version_code": 2,
            "version_name": "1.1.0",
            "force_update": True,
            "release_notes": "Security and stability improvements.",
            "apk_url": "https://app.example.com/releases/lanying-jipai-1.1.0.apk",
            "apk_sha256": "a" * 64,
        },
    }


def test_settings_rejects_invalid_enabled_android_release_config(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///test.db")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-at-least-thirty-two-bytes")
    monkeypatch.setenv("AES_KEY", "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=")
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_CODE", "2")
    monkeypatch.setenv("ANDROID_UPDATE_VERSION_NAME", "1.1.0")
    monkeypatch.setenv(
        "ANDROID_UPDATE_APK_URL",
        "https://app.example.com/releases/lanying-jipai-1.1.0.apk",
    )
    monkeypatch.setenv("ANDROID_UPDATE_APK_SHA256", "not-a-sha256")
    monkeypatch.setenv("ANDROID_UPDATE_RELEASE_NOTES", "Security and stability improvements.")

    with pytest.raises(ValidationError, match="apk_sha256"):
        Settings(_env_file=None)
