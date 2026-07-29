from __future__ import annotations

import argparse
import json
import mimetypes
from urllib.parse import quote, unquote

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.database import get_session_factory
from app.models.order import Order
from app.services.media_storage import CosMinioMediaStorage, MinioCosMediaStorage, _required

MEDIA_FIELDS = ("sample_images", "submitted_media")


def cos_public_base_url(settings: Settings) -> str:
    if settings.cos_public_base_url:
        return settings.cos_public_base_url.rstrip("/")
    return (
        f"https://{_required(settings.cos_bucket, 'COS_BUCKET')}"
        f".cos.{_required(settings.cos_region, 'COS_REGION')}.myqcloud.com"
    )


def rewrite_urls(urls: list[str], source_base_url: str, target_base_url: str) -> tuple[list[str], list[str]]:
    source_prefix = f"{source_base_url.rstrip('/')}/"
    target_prefix = f"{target_base_url.rstrip('/')}/"
    rewritten: list[str] = []
    object_keys: list[str] = []
    for url in urls:
        if not url.startswith(source_prefix):
            rewritten.append(url)
            continue
        object_key = unquote(url.removeprefix(source_prefix))
        rewritten.append(f"{target_prefix}{quote(object_key, safe='/')}")
        object_keys.append(object_key)
    return rewritten, object_keys


def migrate_order_media(session: Session, apply: bool, limit: int | None = None) -> tuple[int, int, int]:
    settings = Settings()
    source = CosMinioMediaStorage(settings)
    target = MinioCosMediaStorage(settings)
    source_base_url = cos_public_base_url(settings)
    target_base_url = _required(settings.minio_public_base_url, "MINIO_PUBLIC_BASE_URL")
    orders = session.scalars(select(Order).order_by(Order.id).limit(limit)).all() if limit else session.scalars(select(Order).order_by(Order.id)).all()
    copied_keys: set[str] = set()
    updated_orders = 0

    for order in orders:
        changed = False
        for field in MEDIA_FIELDS:
            urls = json.loads(getattr(order, field) or "[]")
            rewritten, object_keys = rewrite_urls(urls, source_base_url, target_base_url)
            if not object_keys:
                continue
            if apply:
                for object_key in object_keys:
                    if object_key in copied_keys:
                        continue
                    content = source.fetch_primary(object_key)
                    content_type = mimetypes.guess_type(object_key)[0] or "application/octet-stream"
                    target.upload_primary(object_key, content, content_type)
                    copied_keys.add(object_key)
                setattr(order, field, json.dumps(rewritten, ensure_ascii=False))
            changed = True
        if changed:
            updated_orders += 1

    if apply:
        session.commit()
    return updated_orders, len(copied_keys), len(orders)


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy order media from COS to MinIO and rewrite referenced URLs.")
    parser.add_argument("--apply", action="store_true", help="Copy objects and update database records. Defaults to dry-run.")
    parser.add_argument("--limit", type=int, default=None, help="Process at most this many orders.")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be at least 1")

    session = get_session_factory()()
    try:
        updated_orders, copied_objects, scanned_orders = migrate_order_media(session, args.apply, args.limit)
    finally:
        session.close()
    mode = "applied" if args.apply else "dry-run"
    print(
        f"COS to MinIO media migration {mode}: scanned_orders={scanned_orders} "
        f"updated_orders={updated_orders} copied_objects={copied_objects}"
    )


if __name__ == "__main__":
    main()
