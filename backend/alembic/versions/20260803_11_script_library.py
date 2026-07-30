"""Create the admin script library and seed every source document exactly.

Revision ID: 20260803_11
Revises: 20260802_10
Create Date: 2026-08-03
"""

from collections.abc import Sequence
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
import re

from alembic import op
import sqlalchemy as sa


SQLITE_BIGINT = sa.BigInteger().with_variant(sa.Integer(), "sqlite")

revision: str = "20260803_11"
down_revision: str | None = "20260802_10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


@dataclass(frozen=True)
class SourceDocument:
    id: int
    category_id: int
    source_key: str
    filename: str
    title: str
    expected_sha256: str
    expected_section_count: int
    expected_copy_block_count: int


SOURCE_DOCUMENTS = (
    SourceDocument(
        id=1,
        category_id=1,
        source_key="douyin-ops-scripts",
        filename="douyin-ops-scripts.md",
        title="抖音运营话术库",
        expected_sha256="dfbef0e0f9e77a49dfcd8878e0d49e6989a8bb316c69c7d89c184390faeb95d7",
        expected_section_count=12,
        expected_copy_block_count=46,
    ),
    SourceDocument(
        id=2,
        category_id=2,
        source_key="recruitment-copy",
        filename="recruitment-copy.md",
        title="达人招新物料与教学",
        expected_sha256="04e79f1eaf6ddc0dfa95cf812b639c80a6bcdeace0ea66df855499dda0257fa5",
        expected_section_count=11,
        expected_copy_block_count=33,
    ),
    SourceDocument(
        id=3,
        category_id=3,
        source_key="sensitive-category-scripts",
        filename="sensitive-category-scripts.md",
        title="敏感品类寄拍话术",
        expected_sha256="018e2b19c6ed9115c6a4bcf21ea3caea1e1e39ba8a625d6e76ebd8069966398c",
        expected_section_count=13,
        expected_copy_block_count=34,
    ),
)


def source_directory() -> Path:
    return Path(__file__).resolve().parents[3] / "docs" / "话术"


def load_document(source: SourceDocument) -> dict[str, object]:
    path = source_directory() / source.filename
    try:
        markdown_body = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise RuntimeError(f"话术源文件不存在，已停止迁移: {path}") from exc

    content_sha256 = sha256(markdown_body.encode("utf-8")).hexdigest()
    section_count = len(re.findall(r"(?m)^##\s+", markdown_body))
    copy_block_count = len(re.findall(r"(?s)```(?:\w+)?\s*\r?\n(.*?)\r?\n```", markdown_body))
    if (
        content_sha256 != source.expected_sha256
        or section_count != source.expected_section_count
        or copy_block_count != source.expected_copy_block_count
    ):
        raise RuntimeError(
            "话术源文件内容与本迁移锁定版本不一致，已停止迁移: "
            f"{source.filename} (sha256={content_sha256}, sections={section_count}, blocks={copy_block_count})"
        )
    return {
        "id": source.id,
        "category_id": source.category_id,
        "source_key": source.source_key,
        "source_filename": source.filename,
        "title": source.title,
        "markdown_body": markdown_body,
        "content_sha256": content_sha256,
        "section_count": section_count,
        "copy_block_count": copy_block_count,
    }


def upgrade() -> None:
    op.create_table(
        "script_categories",
        sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("display_order", sa.SmallInteger(), nullable=False),
        sa.Column("is_restricted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("code", name="uq_script_categories_code"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_script_categories_display_order", "script_categories", ["display_order"])
    op.create_table(
        "script_documents",
        sa.Column("id", SQLITE_BIGINT, primary_key=True, autoincrement=True),
        sa.Column("category_id", SQLITE_BIGINT, sa.ForeignKey("script_categories.id"), nullable=False),
        sa.Column("source_key", sa.String(length=80), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=False),
        sa.Column("title", sa.String(length=150), nullable=False),
        sa.Column("markdown_body", sa.Text(), nullable=False),
        sa.Column("content_sha256", sa.String(length=64), nullable=False),
        sa.Column("section_count", sa.SmallInteger(), nullable=False),
        sa.Column("copy_block_count", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("source_key", name="uq_script_documents_source_key"),
        sa.UniqueConstraint("source_filename", name="uq_script_documents_source_filename"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_script_documents_category_id", "script_documents", ["category_id"])
    op.bulk_insert(
        sa.table(
            "script_categories",
            sa.column("id", SQLITE_BIGINT),
            sa.column("code", sa.String()),
            sa.column("name", sa.String()),
            sa.column("description", sa.String()),
            sa.column("display_order", sa.SmallInteger()),
            sa.column("is_restricted", sa.Boolean()),
        ),
        [
            {
                "id": 1,
                "code": "douyin_ops",
                "name": "抖音运营话术",
                "description": "私信拉新、回复跟进、导流与风控 SOP",
                "display_order": 10,
                "is_restricted": False,
            },
            {
                "id": 2,
                "code": "recruitment_training",
                "name": "达人招新与教学",
                "description": "招新物料、平台介绍、口播、社群和培训资料",
                "display_order": 20,
                "is_restricted": False,
            },
            {
                "id": 3,
                "code": "sensitive_category",
                "name": "敏感品类话术",
                "description": "仅限运营场景查看的成年、自愿、合规沟通内容",
                "display_order": 30,
                "is_restricted": True,
            },
        ],
    )
    op.bulk_insert(
        sa.table(
            "script_documents",
            sa.column("id", SQLITE_BIGINT),
            sa.column("category_id", SQLITE_BIGINT),
            sa.column("source_key", sa.String()),
            sa.column("source_filename", sa.String()),
            sa.column("title", sa.String()),
            sa.column("markdown_body", sa.Text()),
            sa.column("content_sha256", sa.String()),
            sa.column("section_count", sa.SmallInteger()),
            sa.column("copy_block_count", sa.SmallInteger()),
        ),
        [load_document(source) for source in SOURCE_DOCUMENTS],
    )


def downgrade() -> None:
    op.drop_index("ix_script_documents_category_id", table_name="script_documents")
    op.drop_table("script_documents")
    op.drop_index("ix_script_categories_display_order", table_name="script_categories")
    op.drop_table("script_categories")
