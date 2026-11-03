"""Consistent JSON error envelope for the API."""

from __future__ import annotations

from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.response import Response
from rest_framework import status


def api_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    code = getattr(exc, "default_code", "error")
    if isinstance(response.data, dict) and "detail" in response.data:
        detail = response.data["detail"]
    else:
        detail = response.data

    response.data = {
        "error": {
            "status": response.status_code,
            "code": code,
            "detail": detail,
        }
    }
    return response
