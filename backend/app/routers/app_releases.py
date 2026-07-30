from fastapi import APIRouter

from app.config import Settings
from app.schemas.app_release import AndroidReleaseManifest

router = APIRouter()


@router.get("/app-releases/android/latest")
def latest_android_release() -> dict[str, object]:
    settings = Settings()
    if settings.android_update_version_code <= 0:
        return {"code": 0, "message": "ok", "data": None}

    manifest = AndroidReleaseManifest(
        version_code=settings.android_update_version_code,
        version_name=settings.android_update_version_name,
        release_notes=settings.android_update_release_notes,
        apk_url=settings.android_update_apk_url,
        apk_sha256=settings.android_update_apk_sha256,
    )

    return {"code": 0, "message": "ok", "data": manifest.model_dump(mode="json")}
