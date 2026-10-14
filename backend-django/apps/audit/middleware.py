"""Request correlation-id / client-info middleware for audit context."""

from __future__ import annotations

import uuid

from common.context import set_request_context


def _client_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


class RequestContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        correlation_id = request.META.get("HTTP_X_REQUEST_ID") or uuid.uuid4().hex
        request.correlation_id = correlation_id
        set_request_context(
            {
                "correlation_id": correlation_id,
                "ip_address": _client_ip(request),
                "user_agent": request.META.get("HTTP_USER_AGENT", "")[:512],
            }
        )
        response = self.get_response(request)
        response["X-Request-ID"] = correlation_id
        return response
