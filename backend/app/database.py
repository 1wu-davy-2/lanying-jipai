from functools import lru_cache

from collections.abc import Generator

from sqlalchemy import BigInteger, Engine, Integer, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import Settings


class Base(DeclarativeBase):
    pass


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


@lru_cache
def get_engine() -> Engine:
    """Create the MariaDB engine only when database access is requested."""
    settings = Settings()
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)


@lru_cache
def get_session_factory() -> sessionmaker:
    return sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
