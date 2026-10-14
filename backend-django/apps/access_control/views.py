"""RBAC management endpoints with delegation invariants."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import record_audit
from navigation.models import Menu, RoleMenu

from . import policy
from .catalog import REGISTERED_CODES, is_registered
from .models import Permission, Role, RolePermission, UserPermissionOverride, UserRole
from .permissions import HasPermission
from .serializers import (
    PermissionSerializer,
    RoleMenuAssignSerializer,
    RolePermissionAssignSerializer,
    RoleSerializer,
    UserPermissionOverrideAssignSerializer,
    UserRoleAssignSerializer,
)

User = get_user_model()
ADMIN_ROLE_CODE = "administrator"


def _role_authority_codes(role) -> set[str]:
    return {
        code
        for code in role.role_permissions.values_list("permission__code", flat=True)
        if is_registered(code)
    }


def _active_administrator_count() -> int:
    return (
        User.objects.filter(
            is_active=True,
            deleted_at__isnull=True,
            user_roles__role__code=ADMIN_ROLE_CODE,
            user_roles__role__is_active=True,
        )
        .distinct()
        .count()
    )


class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.filter(deleted_at__isnull=True)
    serializer_class = RoleSerializer
    search_fields = ["code", "name", "description"]
    ordering_fields = ["code", "name", "created_at"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [HasPermission("roles.read")()]
        if self.action == "set_permissions":
            return [HasPermission("permissions.assign")()]
        if self.action == "set_menus":
            return [HasPermission("menus.assign")()]
        return [HasPermission("roles.manage")()]

    def perform_create(self, serializer):
        role = serializer.save()
        record_audit(
            actor=self.request.user,
            action="role_created",
            resource_type="Role",
            object_id=role.pk,
            after={"code": role.code, "name": role.name},
        )

    def perform_update(self, serializer):
        before = {"code": serializer.instance.code, "is_active": serializer.instance.is_active}
        role = serializer.save()
        record_audit(
            actor=self.request.user,
            action="role_updated",
            resource_type="Role",
            object_id=role.pk,
            before=before,
            after={"code": role.code, "is_active": role.is_active},
        )

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.is_system:
            return Response(
                {"error": {"detail": "System roles cannot be deactivated."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role.is_active = False
        role.deleted_at = role.updated_at  # noqa: set below
        from django.utils import timezone

        role.deleted_at = timezone.now()
        role.save(update_fields=["is_active", "deleted_at", "updated_at"])
        record_audit(
            actor=request.user,
            action="role_deactivated",
            resource_type="Role",
            object_id=role.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get", "put"], url_path="permissions")
    def set_permissions(self, request, pk=None):
        role = self.get_object()
        if request.method == "GET":
            return Response(
                {"permission_codes": sorted(_role_authority_codes(role))}
            )

        serializer = RolePermissionAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        codes = serializer.validated_data["permission_codes"]

        actor = request.user
        if role.code == ADMIN_ROLE_CODE and not actor.is_protected_admin:
            return Response(
                {"error": {"detail": "Only the protected administrator may modify the administrator role."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not actor.is_protected_admin and not policy.can_grant_permissions(actor, codes):
            return Response(
                {"error": {"detail": "You cannot grant permissions you do not hold."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        with transaction.atomic():
            locked = Role.objects.select_for_update().get(pk=role.pk)
            permissions = list(Permission.objects.filter(code__in=codes))
            locked.role_permissions.all().delete()
            RolePermission.objects.bulk_create(
                [
                    RolePermission(role=locked, permission=p, granted_by=actor)
                    for p in permissions
                ]
            )
        record_audit(
            actor=actor,
            action="role_permissions_updated",
            resource_type="Role",
            object_id=role.pk,
            after={"permission_codes": sorted(codes)},
        )
        return Response({"permission_codes": sorted(codes)})

    @action(detail=True, methods=["get", "put"], url_path="menus")
    def set_menus(self, request, pk=None):
        role = self.get_object()
        if request.method == "GET":
            return Response(
                {"menu_ids": list(role.role_menus.values_list("menu_id", flat=True))}
            )

        serializer = RoleMenuAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        menu_ids = serializer.validated_data["menu_ids"]

        actor = request.user
        menus = list(Menu.objects.filter(pk__in=menu_ids))
        if not actor.is_protected_admin:
            required = {m.required_permission for m in menus if m.required_permission}
            if not policy.can_grant_permissions(actor, required):
                return Response(
                    {"error": {"detail": "You cannot assign menus requiring permissions you do not hold."}},
                    status=status.HTTP_403_FORBIDDEN,
                )

        with transaction.atomic():
            locked = Role.objects.select_for_update().get(pk=role.pk)
            locked.role_menus.all().delete()
            RoleMenu.objects.bulk_create(
                [RoleMenu(role=locked, menu=m, granted_by=actor) for m in menus]
            )
        record_audit(
            actor=actor,
            action="role_menus_updated",
            resource_type="Role",
            object_id=role.pk,
            after={"menu_ids": sorted(menu_ids)},
        )
        return Response({"menu_ids": sorted(menu_ids)})


class PermissionViewSet(viewsets.ModelViewSet):
    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    search_fields = ["code", "resource", "action", "description"]
    ordering_fields = ["code", "resource", "action", "created_at"]
    filterset_fields = ["resource", "action", "is_active"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [HasPermission("permissions.read")()]
        return [HasPermission("permissions.manage")()]

    def create(self, request, *args, **kwargs):
        actor = request.user
        if not actor.is_protected_admin:
            return Response(
                {"error": {"detail": "Only the protected administrator may define permissions."}},
                status=status.HTTP_403_FORBIDDEN,
            )
        code = str(request.data.get("code", ""))
        if is_registered(code):
            return Response(
                {"error": {"detail": "This permission code is registered and already provisioned."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permission = serializer.save(is_system=False)
        record_audit(
            actor=actor,
            action="permission_created",
            resource_type="Permission",
            object_id=permission.pk,
            after={"code": permission.code, "effective": False},
        )
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.is_system:
            # System permissions are immutable in code/resource/action.
            for field in ("code", "resource", "action"):
                if field in self.request.data and str(self.request.data[field]) != getattr(
                    instance, field
                ):
                    from rest_framework.exceptions import PermissionDenied

                    raise PermissionDenied("System permission identity fields are immutable.")
        permission = serializer.save()
        record_audit(
            actor=self.request.user,
            action="permission_updated",
            resource_type="Permission",
            object_id=permission.pk,
        )

    def destroy(self, request, *args, **kwargs):
        permission = self.get_object()
        if permission.is_system:
            return Response(
                {"error": {"detail": "System permissions cannot be removed."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        permission.is_active = False
        permission.save(update_fields=["is_active", "updated_at"])
        record_audit(
            actor=request.user,
            action="permission_deactivated",
            resource_type="Permission",
            object_id=permission.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserRolesView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [HasPermission("users.read")()]
        return [HasPermission("roles.assign")()]

    def get(self, request, user_id):
        target = get_object_or_404(User, pk=user_id, deleted_at__isnull=True)
        role_ids = list(
            target.user_roles.filter(role__deleted_at__isnull=True).values_list(
                "role_id", flat=True
            )
        )
        return Response({"role_ids": role_ids})

    def put(self, request, user_id):
        target = get_object_or_404(User, pk=user_id, deleted_at__isnull=True)
        serializer = UserRoleAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role_ids = serializer.validated_data["role_ids"]
        actor = request.user

        if target.is_protected_admin and not actor.is_protected_admin:
            return Response(
                {"error": {"detail": "The protected administrator's roles cannot be changed."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        roles = list(Role.objects.filter(pk__in=role_ids, deleted_at__isnull=True))
        if len(roles) != len(set(role_ids)):
            return Response(
                {"error": {"detail": "One or more roles do not exist."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not actor.is_protected_admin:
            for role in roles:
                authority = _role_authority_codes(role)
                if not policy.can_grant_permissions(actor, authority):
                    return Response(
                        {"error": {"detail": f"You cannot assign role '{role.code}' beyond your own authority."}},
                        status=status.HTTP_403_FORBIDDEN,
                    )

        with transaction.atomic():
            locked_user = User.objects.select_for_update().get(pk=target.pk)
            current_role_ids = set(
                locked_user.user_roles.values_list("role_id", flat=True)
            )
            admin_role = Role.objects.filter(code=ADMIN_ROLE_CODE).first()
            removing_admin = (
                admin_role is not None
                and admin_role.pk in current_role_ids
                and admin_role.pk not in set(role_ids)
            )
            if removing_admin and _active_administrator_count() <= 1:
                return Response(
                    {"error": {"detail": "Cannot remove the final administrator."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            locked_user.user_roles.all().delete()
            UserRole.objects.bulk_create(
                [
                    UserRole(user=locked_user, role=role, assigned_by=actor)
                    for role in roles
                ]
            )
        record_audit(
            actor=actor,
            action="user_roles_updated",
            resource_type="User",
            object_id=target.pk,
            after={"role_ids": sorted(role_ids)},
        )
        return Response({"role_ids": sorted(role_ids)})


class UserPermissionOverridesView(APIView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [HasPermission("permissions.read")()]
        return [HasPermission("permissions.assign")()]

    def get(self, request, user_id):
        target = get_object_or_404(User, pk=user_id, deleted_at__isnull=True)
        overrides = [
            {"permission_code": o.permission.code, "effect": o.effect}
            for o in target.permission_overrides.select_related("permission")
        ]
        return Response({"overrides": overrides})

    def put(self, request, user_id):
        target = get_object_or_404(User, pk=user_id, deleted_at__isnull=True)
        serializer = UserPermissionOverrideAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        overrides = serializer.validated_data["overrides"]
        actor = request.user

        if target.is_protected_admin:
            return Response(
                {"error": {"detail": "Overrides cannot be applied to the protected administrator."}},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not actor.is_protected_admin:
            codes = {item["permission_code"] for item in overrides}
            if not policy.can_grant_permissions(actor, codes):
                return Response(
                    {"error": {"detail": "You cannot override permissions you do not hold."}},
                    status=status.HTTP_403_FORBIDDEN,
                )

        with transaction.atomic():
            locked_user = User.objects.select_for_update().get(pk=target.pk)
            locked_user.permission_overrides.all().delete()
            permissions = {
                p.code: p for p in Permission.objects.filter(
                    code__in=[item["permission_code"] for item in overrides]
                )
            }
            UserPermissionOverride.objects.bulk_create(
                [
                    UserPermissionOverride(
                        user=locked_user,
                        permission=permissions[item["permission_code"]],
                        effect=item["effect"],
                        granted_by=actor,
                    )
                    for item in overrides
                ]
            )
        record_audit(
            actor=actor,
            action="user_overrides_updated",
            resource_type="User",
            object_id=target.pk,
            after={"overrides": overrides},
        )
        return Response({"overrides": overrides})
