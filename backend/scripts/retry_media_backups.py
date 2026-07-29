from __future__ import annotations

import argparse

from app.database import get_session_factory
from app.services.media_backup import retry_pending_backups


def main() -> None:
    parser = argparse.ArgumentParser(description="Retry pending COS to MinIO media backups.")
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--force", action="store_true", help="Ignore the scheduled retry time.")
    args = parser.parse_args()

    if args.limit < 1:
        parser.error("--limit must be at least 1")

    session = get_session_factory()()
    try:
        synced, failed = retry_pending_backups(session, limit=args.limit, force=args.force)
    finally:
        session.close()
    print(f"media backup retry completed: synced={synced} failed={failed}")


if __name__ == "__main__":
    main()
