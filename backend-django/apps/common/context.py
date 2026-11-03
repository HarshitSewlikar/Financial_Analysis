"""Request-scoped context shared across apps (correlation id, client info)."""

from __future__ import annotations

import contextvars

# Set by audit.middleware.RequestContextMiddleware for the duration of a request.
request_context: contextvars.ContextVar = contextvars.ContextVar(
    "request_context", default={}
)


def get_request_context() -> dict:
    return request_context.get()


def set_request_context(value: dict) -> None:
    request_context.set(value or {})
