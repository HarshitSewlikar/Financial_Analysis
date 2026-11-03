from __future__ import annotations

from rest_framework import serializers

from .models import Menu
from .registry import ALLOWED_COMPONENT_KEYS


class MenuSerializer(serializers.ModelSerializer):
    class Meta:
        model = Menu
        fields = [
            "id",
            "code",
            "label",
            "path",
            "component_key",
            "required_permission",
            "parent",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_component_key(self, value):
        if value not in ALLOWED_COMPONENT_KEYS:
            raise serializers.ValidationError(
                f"Unknown component_key '{value}'. Allowed: {sorted(ALLOWED_COMPONENT_KEYS)}"
            )
        return value

    def validate_required_permission(self, value):
        if not value:
            return value
        from access_control.catalog import is_registered

        if not is_registered(value):
            raise serializers.ValidationError(
                f"'{value}' is not a registered permission code."
            )
        return value
