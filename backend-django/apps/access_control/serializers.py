"""Serializers for role/permission/menu assignment operations."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .catalog import is_registered
from .models import (
    Permission,
    Role,
    RolePermission,
    UserPermissionOverride,
    UserRole,
)

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    is_effective = serializers.SerializerMethodField()

    class Meta:
        model = Permission
        fields = [
            "id",
            "code",
            "resource",
            "action",
            "description",
            "is_system",
            "is_active",
            "is_effective",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "is_effective"]

    def get_is_effective(self, obj):
        return is_registered(obj.code)


class RoleSerializer(serializers.ModelSerializer):
    permission_codes = serializers.SerializerMethodField()
    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Role
        fields = [
            "id",
            "code",
            "name",
            "description",
            "is_system",
            "is_active",
            "permission_codes",
            "user_count",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = [
            "id",
            "is_system",
            "created_at",
            "updated_at",
            "deleted_at",
            "permission_codes",
            "user_count",
        ]

    def get_permission_codes(self, obj):
        return sorted(
            obj.role_permissions.values_list("permission__code", flat=True)
        )

    def get_user_count(self, obj):
        return obj.user_roles.count()


class PermissionCodeListField(serializers.ListField):
    child = serializers.CharField(max_length=150)

    def to_internal_value(self, data):
        codes = super().to_internal_value(data)
        unknown = [code for code in codes if not is_registered(code)]
        if unknown:
            raise serializers.ValidationError(
                f"Unknown permission code(s): {', '.join(unknown)}"
            )
        return codes


class RolePermissionAssignSerializer(serializers.Serializer):
    permission_codes = PermissionCodeListField()

    def validate_permission_codes(self, value):
        existing = set(Permission.objects.values_list("code", flat=True))
        missing = [code for code in value if code not in existing]
        if missing:
            raise serializers.ValidationError(
                f"Permission(s) not found: {', '.join(missing)}"
            )
        return value


class MenuIdListField(serializers.ListField):
    child = serializers.IntegerField()


class RoleMenuAssignSerializer(serializers.Serializer):
    menu_ids = MenuIdListField()

    def validate_menu_ids(self, value):
        from navigation.models import Menu

        existing = set(Menu.objects.filter(pk__in=value).values_list("id", flat=True))
        missing = [str(mid) for mid in value if mid not in existing]
        if missing:
            raise serializers.ValidationError(f"Menu(s) not found: {', '.join(missing)}")
        return value


class UserRoleAssignSerializer(serializers.Serializer):
    role_ids = serializers.ListField(child=serializers.IntegerField())

    def validate_role_ids(self, value):
        existing = set(Role.objects.filter(pk__in=value).values_list("id", flat=True))
        missing = [str(rid) for rid in value if rid not in existing]
        if missing:
            raise serializers.ValidationError(f"Role(s) not found: {', '.join(missing)}")
        return value


class OverrideItemSerializer(serializers.Serializer):
    permission_code = serializers.CharField(max_length=150)
    effect = serializers.ChoiceField(choices=UserPermissionOverride.Effect.choices)

    def validate_permission_code(self, value):
        if not is_registered(value):
            raise serializers.ValidationError(f"Unknown permission code: {value}")
        if not Permission.objects.filter(code=value).exists():
            raise serializers.ValidationError(f"Permission not found: {value}")
        return value


class UserPermissionOverrideAssignSerializer(serializers.Serializer):
    overrides = OverrideItemSerializer(many=True)


class UserRoleSerializer(serializers.ModelSerializer):
    role_code = serializers.CharField(source="role.code", read_only=True)
    role_name = serializers.CharField(source="role.name", read_only=True)

    class Meta:
        model = UserRole
        fields = ["id", "role", "role_code", "role_name", "assigned_at", "expires_at"]
        read_only_fields = fields
