from __future__ import annotations

import base64
import os
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any

import bcrypt
import jwt
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import Settings

_LOGIN_FAILURES: dict[str, list[datetime]] = {}
_LOGIN_LOCKED_UNTIL: dict[str, datetime] = {}
_LOGIN_LOCK = Lock()
_LOGIN_FAILURE_WINDOW = timedelta(minutes=15)
_LOGIN_LOCK_DURATION = timedelta(minutes=15)
_MAX_LOGIN_FAILURES = 5


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def create_token(subject: int, token_type: str, expires_delta: timedelta) -> str:
    settings = Settings()
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm="HS256")


def create_access_token(subject: int) -> str:
    return create_token(subject, "access", timedelta(minutes=Settings().access_token_minutes))


def create_refresh_token(subject: int) -> str:
    return create_token(subject, "refresh", timedelta(days=Settings().refresh_token_days))


def decode_token(token: str, expected_type: str) -> int:
    try:
        payload = jwt.decode(token, Settings().jwt_secret_key, algorithms=["HS256"])
        if payload.get("type") != expected_type:
            raise jwt.InvalidTokenError("unexpected token type")
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError) as exc:
        raise ValueError("token 无效或已过期") from exc


def encrypt_sensitive(value: str) -> str:
    key = base64.b64decode(Settings().aes_key, validate=True)
    if len(key) != 32:
        raise ValueError("AES_KEY 必须是 32 字节 Base64 密钥")
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, value.encode(), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()


def decrypt_sensitive(value: str) -> str:
    key = base64.b64decode(Settings().aes_key, validate=True)
    raw = base64.urlsafe_b64decode(value.encode())
    return AESGCM(key).decrypt(raw[:12], raw[12:], None).decode()


def mask_id_card(id_card_no: str | None) -> str | None:
    if not id_card_no:
        return None
    if len(id_card_no) <= 8:
        return "*" * len(id_card_no)
    return f"{id_card_no[:3]}{'*' * (len(id_card_no) - 7)}{id_card_no[-4:]}"


def login_is_locked(phone: str) -> bool:
    now = datetime.now(timezone.utc)
    with _LOGIN_LOCK:
        locked_until = _LOGIN_LOCKED_UNTIL.get(phone)
        if locked_until and locked_until > now:
            return True
        _LOGIN_LOCKED_UNTIL.pop(phone, None)
        return False


def record_login_failure(phone: str) -> None:
    now = datetime.now(timezone.utc)
    with _LOGIN_LOCK:
        failures = [attempt for attempt in _LOGIN_FAILURES.get(phone, []) if now - attempt <= _LOGIN_FAILURE_WINDOW]
        failures.append(now)
        _LOGIN_FAILURES[phone] = failures
        if len(failures) >= _MAX_LOGIN_FAILURES:
            _LOGIN_LOCKED_UNTIL[phone] = now + _LOGIN_LOCK_DURATION


def clear_login_failures(phone: str) -> None:
    with _LOGIN_LOCK:
        _LOGIN_FAILURES.pop(phone, None)
        _LOGIN_LOCKED_UNTIL.pop(phone, None)
