"""Encrypt «Мой налог» tokens at rest (Fernet, key derived from SECRET_KEY)."""

from __future__ import annotations

import base64
import hashlib

from django.conf import settings

_ENC_PREFIX = "enc:"


def _fernet():
    from cryptography.fernet import Fernet

    digest = hashlib.sha256(f"vmeste-moy-nalog:{settings.SECRET_KEY}".encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str | None) -> str:
    if not value:
        return ""
    return _ENC_PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("ascii")


def decrypt_secret(stored: str | None) -> str:
    if not stored:
        return ""
    if not stored.startswith(_ENC_PREFIX):
        return stored
    return _fernet().decrypt(stored[len(_ENC_PREFIX) :].encode("ascii")).decode("utf-8")
