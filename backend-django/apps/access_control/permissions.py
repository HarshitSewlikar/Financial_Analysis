"""DRF permission classes backed by the central policy service."""

from __future__ import annotations

from rest_framework.permissions import BasePermission, SAFE_METHODS

from . import policy


def _authenticated(user) -> bool:
    return bool(user and user.is_authenticated and user.is_active and user.deleted_at is None)


def HasPermission(code: str):
    """Factory: allow only callers holding the given registered permission."""

    class _HasPermission(BasePermission):
        message = f"Missing required permission: {code}"

        def has_permission(self, request, view):
            return policy.has_permission(request.user, code)

    _HasPermission.__name__ = f"HasPermission_{code.replace('.', '_')}"
    return _HasPermission


class IsBootstrapAllowed(BasePermission):
    """Allow only while bootstrap setup is still incomplete."""

    message = "Bootstrap setup is already complete."

    def has_permission(self, request, view):
        from accounts.models import SetupState

        state = SetupState.objects.filter(pk=1).first()
        return bool(state and not state.is_bootstrapped)


class CanManageTargetUser(BasePermission):
    """Object-level guard for modifying a specific user."""

    message = "You are not allowed to manage this user."

    def has_object_permission(self, request, view, obj):
        actor = request.user
        if not _authenticated(actor):
            return False
        if obj.pk == actor.pk:
            return True
        # Protected bootstrap administrator is immutable except by itself.
        if obj.is_protected_admin and actor.pk != obj.pk:
            return False
        return policy.has_permission(actor, "users.update")


class CanAssignRole(BasePermission):
    message = "You are not allowed to assign roles."

    def has_permission(self, request, view):
        return policy.has_permission(request.user, "roles.assign")


class CanManagePermission(BasePermission):
    message = "You are not allowed to manage permissions."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return policy.has_permission(request.user, "permissions.read")
        return policy.has_permission(request.user, "permissions.manage")


class CanManageMenu(BasePermission):
    message = "You are not allowed to manage menus."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return policy.has_permission(request.user, "menus.read")
        return policy.has_permission(request.user, "menus.manage")


class CanAccessTodo(BasePermission):
    message = "You are not allowed to access this to-do."

    def has_object_permission(self, request, view, obj):
        actor = request.user
        if not _authenticated(actor):
            return False
        if actor.is_protected_admin or policy.has_permission(actor, "todos.manage"):
            return True
        return obj.owner_id == actor.pk or obj.assignee_id == actor.pk


class CanReadAudit(BasePermission):
    message = "You are not allowed to read audit logs."

    def has_permission(self, request, view):
        return policy.has_permission(request.user, "audit.read")
