"""User administration ViewSet."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from access_control.models import Role
from access_control.permissions import CanManageTargetUser, HasPermission
from audit.services import record_audit

from .serializers import (
    UserAdminSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
)

User = get_user_model()
ADMIN_ROLE_CODE = "administrator"


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(deleted_at__isnull=True)
    serializer_class = UserAdminSerializer
    search_fields = ["username", "name", "email"]
    ordering_fields = ["username", "created_at", "last_login"]
    filterset_fields = ["is_active"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [HasPermission("users.read")()]
        if self.action == "create":
            return [HasPermission("users.create")()]
        if self.action in {"update", "partial_update"}:
            return [HasPermission("users.update")(), CanManageTargetUser()]
        if self.action == "destroy":
            return [HasPermission("users.deactivate")(), CanManageTargetUser()]
        return [HasPermission("users.read")()]

    def create(self, request, *args, **kwargs):
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = User.objects.create_user(
            username=data["username"],
            password=data["password"],
            name=data.get("name", ""),
            email=data.get("email", ""),
            is_active=data.get("is_active", True),
        )
        record_audit(
            actor=request.user,
            action="user_created",
            resource_type="User",
            object_id=user.pk,
            after={"username": user.username, "is_active": user.is_active},
        )
        return Response(
            UserAdminSerializer(user).data, status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        target = self.get_object()
        serializer = UserUpdateSerializer(data=request.data, instance=target)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if target.is_protected_admin:
            if not request.user.is_protected_admin:
                return Response(
                    {"error": {"detail": "The protected administrator cannot be modified."}},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if data.get("is_active") is False:
                return Response(
                    {"error": {"detail": "The protected administrator cannot be deactivated."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        before = {"name": target.name, "email": target.email, "is_active": target.is_active}
        if "name" in data:
            target.name = data["name"]
        if "email" in data:
            target.email = data["email"]
        if "is_active" in data:
            new_active = data["is_active"]
            if new_active is False and self._is_last_active_admin(target):
                return Response(
                    {"error": {"detail": "Cannot deactivate the final administrator."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target.is_active = new_active
        if data.get("password"):
            target.set_password(data["password"])
        target.save()
        record_audit(
            actor=request.user,
            action="user_updated",
            resource_type="User",
            object_id=target.pk,
            before=before,
            after={"name": target.name, "email": target.email, "is_active": target.is_active},
        )
        return Response(UserAdminSerializer(target).data)

    def destroy(self, request, *args, **kwargs):
        target = self.get_object()
        if target.pk == request.user.pk:
            return Response(
                {"error": {"detail": "You cannot deactivate your own account."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if target.is_protected_admin:
            return Response(
                {"error": {"detail": "The protected administrator cannot be deactivated."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if self._is_last_active_admin(target):
            return Response(
                {"error": {"detail": "Cannot deactivate the final administrator."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            locked = User.objects.select_for_update().get(pk=target.pk)
            locked.deleted_at = timezone.now()
            locked.is_active = False
            locked.save(update_fields=["deleted_at", "is_active", "updated_at"])
        record_audit(
            actor=request.user,
            action="user_deactivated",
            resource_type="User",
            object_id=target.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @staticmethod
    def _is_last_active_admin(target) -> bool:
        if not target.user_roles.filter(role__code=ADMIN_ROLE_CODE).exists():
            return False
        count = (
            User.objects.filter(
                is_active=True,
                deleted_at__isnull=True,
                user_roles__role__code=ADMIN_ROLE_CODE,
                user_roles__role__is_active=True,
            )
            .distinct()
            .count()
        )
        return count <= 1
