import logging
from io import BytesIO
from datetime import datetime
from pathlib import Path
from secrets import token_urlsafe

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.services.media_backup import sync_new_backup
from app.services.media_storage import (
    PrimaryStorageError,
    StorageConfigurationError,
    get_media_storage,
)

router = APIRouter(tags=["uploads"])
logger = logging.getLogger(__name__)

_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "video/mp4"}
_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".mp4"}
_MAX_FILE_SIZE = 10 * 1024 * 1024
_IMAGE_FORMATS = {".jpg": "JPEG", ".jpeg": "JPEG", ".png": "PNG", ".webp": "WEBP"}


def content_is_valid(content: bytes, suffix: str) -> bool:
    if suffix == ".mp4":
        return len(content) >= 12 and content[4:8] == b"ftyp"
    try:
        with Image.open(BytesIO(content)) as image:
            image.verify()
            return image.format == _IMAGE_FORMATS[suffix]
    except (KeyError, UnidentifiedImageError, OSError, SyntaxError):
        return False


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
    session: Session = Depends(get_db),
) -> dict[str, object]:
    suffix = Path(file.filename or "").suffix.lower()
    if file.content_type not in _ALLOWED_TYPES or suffix not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="仅支持 JPG、PNG、WEBP 图片或 MP4 视频")
    content = await file.read(_MAX_FILE_SIZE + 1)
    if len(content) > _MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件不能超过 10MB")
    if not content_is_valid(content, suffix):
        raise HTTPException(status_code=400, detail="文件内容与声明类型不匹配")
    now = datetime.now()
    filename = f"{token_urlsafe(18)}{suffix}"
    object_key = f"{now:%Y}/{now:%m}/{filename}"

    try:
        storage = get_media_storage()
        url = storage.upload_primary(object_key, content, file.content_type)
    except StorageConfigurationError:
        logger.exception("Media storage configuration is invalid")
        raise HTTPException(status_code=500, detail="媒体存储配置不完整")
    except PrimaryStorageError:
        logger.exception("Primary media storage upload failed")
        raise HTTPException(status_code=502, detail="主存储上传失败，请稍后重试")

    if storage.backup_enabled:
        sync_new_backup(session, storage, object_key, content, file.content_type)

    return {"code": 0, "message": "ok", "data": {"url": url}}
