"""Helpers shared across local apps."""

from __future__ import annotations

import re

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.@+-]{3,150}$")


def normalize_username(value) -> str:
    return str(value or "").strip().lower()


def normalize_email(value) -> str:
    return str(value or "").strip().lower()


def is_valid_username(value: str) -> bool:
    return bool(_USERNAME_RE.match(value or ""))
