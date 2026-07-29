from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models.media import MediaBackupJob
from app.services.media_storage import (
    CosMinioMediaStorage,
    MinioCosMediaStorage,
    get_storage_for_backup,
)

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _next_retry_at(attempt_count: int) -> datetime:
    base_minutes = Settings().media_backup_retry_base_minutes
    delay_minutes = min(base_minutes * (2 ** min(attempt_count - 1, 6)), 24 * 60)
    return utc_now() + timedelta(minutes=delay_minutes)


def _mark_synced(session: Session, job: MediaBackupJob) -> None:
    now = utc_now()
    job.status = "SYNCED"
    job.attempt_count += 1
    job.last_error = None
    job.last_attempt_at = now
    job.next_retry_at = None
    job.synced_at = now
    session.commit()


def _mark_retry(session: Session, job: MediaBackupJob, error: Exception) -> None:
    job.status = "PENDING"
    job.attempt_count += 1
    job.last_error = str(error)[:2000]
    job.last_attempt_at = utc_now()
    job.next_retry_at = _next_retry_at(job.attempt_count)
    session.commit()


def create_backup_job(
    session: Session,
    object_key: str,
    content_type: str,
    content_size: int,
    primary_storage: str,
    backup_storage: str,
) -> MediaBackupJob:
    job = MediaBackupJob(
        object_key=object_key,
        content_type=content_type,
        content_size=content_size,
        primary_storage=primary_storage,
        backup_storage=backup_storage,
        status="PENDING",
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def sync_new_backup(
    session: Session,
    storage: CosMinioMediaStorage | MinioCosMediaStorage,
    object_key: str,
    content: bytes,
    content_type: str,
) -> bool:
    if storage.backup_storage is None:
        raise RuntimeError("Backup storage is not configured")
    job = create_backup_job(
        session,
        object_key,
        content_type,
        len(content),
        storage.primary_storage,
        storage.backup_storage,
    )
    try:
        storage.backup_content(object_key, content, content_type)
    except Exception as exc:
        logger.exception("MinIO backup failed for %s; job %s is queued for retry", object_key, job.id)
        _mark_retry(session, job, exc)
        return False
    _mark_synced(session, job)
    return True


def retry_pending_backups(session: Session, limit: int = 100, force: bool = False) -> tuple[int, int]:
    statement = select(MediaBackupJob).where(MediaBackupJob.status == "PENDING")
    if not force:
        now = utc_now()
        statement = statement.where(
            or_(MediaBackupJob.next_retry_at.is_(None), MediaBackupJob.next_retry_at <= now)
        )
    jobs = session.scalars(statement.order_by(MediaBackupJob.id).limit(limit)).all()
    synced = 0
    failed = 0

    for job in jobs:
        try:
            storage = get_storage_for_backup(job.primary_storage, job.backup_storage)
            content = storage.fetch_primary(job.object_key)
            storage.backup_content(job.object_key, content, job.content_type)
        except Exception as exc:
            logger.exception("MinIO retry failed for %s", job.object_key)
            _mark_retry(session, job, exc)
            failed += 1
        else:
            _mark_synced(session, job)
            synced += 1
    return synced, failed
