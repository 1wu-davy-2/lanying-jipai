from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base, ID_TYPE
from app.models.user import TimestampMixin


class MediaBackupJob(TimestampMixin, Base):
    __tablename__ = "media_backup_jobs"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    object_key: Mapped[str] = mapped_column(String(512), unique=True, index=True, nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    content_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), index=True, nullable=False, default="PENDING")
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(DateTime, index=True, nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
