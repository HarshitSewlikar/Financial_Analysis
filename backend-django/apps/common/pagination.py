"""Shared DRF pagination classes."""

from rest_framework.pagination import CursorPagination, PageNumberPagination


class StandardPageNumberPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


class AuditCursorPagination(CursorPagination):
    ordering = "-created_at"
    page_size = 50
    max_page_size = 200
