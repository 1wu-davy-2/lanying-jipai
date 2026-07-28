import base64

import pytest


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite+pysqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-at-least-thirty-two-bytes")
    monkeypatch.setenv("AES_KEY", base64.b64encode(b"a" * 32).decode())
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))

    from app import models  # noqa: F401
    from app.database import Base, get_engine, get_session_factory

    get_session_factory.cache_clear()
    get_engine.cache_clear()
    engine = get_engine()
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
    engine.dispose()
    get_session_factory.cache_clear()
    get_engine.cache_clear()
