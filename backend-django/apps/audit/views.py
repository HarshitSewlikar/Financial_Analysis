"""Read-only audit endpoints plus export."""

from __future__ import annotations

import csv

from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from access_control.permissions import HasPermission
from common.pagination import AuditCursorPagination

from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("actor").all()
    serializer_class = AuditLogSerializer
    pagination_class = AuditCursorPagination
    search_fields = ["action", "resource_type", "object_id", "actor__username"]
    ordering = ["-created_at"]
    filterset_fields = ["action", "resource_type", "actor"]

    def get_permissions(self):
        if self.action == "export":
            return [HasPermission("audit.export")()]
        return [HasPermission("audit.read")()]

    def get_queryset(self):
        qs = super().get_queryset()
        resource_type = self.request.query_params.get("resource_type")
        object_id = self.request.query_params.get("object_id")
        action_name = self.request.query_params.get("action")
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if object_id:
            qs = qs.filter(object_id=str(object_id))
        if action_name:
            qs = qs.filter(action=action_name)
        return qs

    @action(detail=False, methods=["get"])
    def export(self, request):
        qs = self.get_queryset()[:5000]
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="audit_logs.csv"'
        writer = csv.writer(response)
        writer.writerow(
            [
                "id",
                "created_at",
                "actor",
                "action",
                "resource_type",
                "object_id",
                "correlation_id",
                "ip_address",
            ]
        )
        for row in qs:
            writer.writerow(
                [
                    row.id,
                    row.created_at.isoformat(),
                    row.actor.username if row.actor else "",
                    row.action,
                    row.resource_type,
                    row.object_id,
                    row.correlation_id,
                    row.ip_address or "",
                ]
            )
        return response
