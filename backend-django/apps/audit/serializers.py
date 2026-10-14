from __future__ import annotations

from rest_framework import serializers

from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "actor",
            "actor_username",
            "action",
            "resource_type",
            "object_id",
            "before",
            "after",
            "correlation_id",
            "ip_address",
            "user_agent",
            "created_at",
        ]
        read_only_fields = fields
