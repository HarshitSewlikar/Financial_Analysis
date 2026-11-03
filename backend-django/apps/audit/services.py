"""Centralized audit writing service.

Call :func:`record_audit` inside the same transaction as the mutation so the
audit row and the mutation commit or roll back together.
"""

from __future__ import annotations

from typing import Any

from common.context import get_request_context

from .models import AuditLog

SENSITIVE_KEYS = {
    "password",
    "passwordhash",
    "password_hash",
    "token",
    "access",
    "access_token",
    "refresh",
    "refresh_token",
    "secret",
    "secret_key",
    "authorization",
    "cookie",
    "set-cookie",
    "signupcode",
    "admin_signup_code",
}


def _redact(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if str(key).lower().replace("-", "_") in SENSITIVE_KEYS:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = _redact(item)
        return cleaned
    if isinstance(value, (list, tuple)):
        return [_redact(item) for item in value]
    return value


def record_audit(
    *,
    actor,
    action: str,
    resource_type: str,
    object_id: str = "",
    before=None,
    after=None,
) -> AuditLog:
    ctx = get_request_context()
    return AuditLog.objects.create(
        actor=actor if getattr(actor, "is_authenticated", False) else None,
        action=action,
        resource_type=resource_type,
        object_id=str(object_id or ""),
        before=_redact(before),
        after=_redact(after),
        correlation_id=ctx.get("correlation_id", ""),
        ip_address=ctx.get("ip_address"),
        user_agent=ctx.get("user_agent", ""),
    )
