from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, ID_TYPE
from app.models.user import TimestampMixin


class ScriptCategory(TimestampMixin, Base):
    __tablename__ = "script_categories"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_restricted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    documents: Mapped[list["ScriptDocument"]] = relationship(back_populates="category")


class ScriptDocument(TimestampMixin, Base):
    __tablename__ = "script_documents"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ID_TYPE, ForeignKey("script_categories.id"), nullable=False)
    source_key: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    source_filename: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    markdown_body: Mapped[str] = mapped_column(Text, nullable=False)
    content_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    section_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    copy_block_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    category: Mapped[ScriptCategory] = relationship(back_populates="documents")
