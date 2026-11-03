"""The single authoritative effective-permission resolver.

All authorization decisions must go through this module. Nothing else may
compute effective permissions. Permissions are resolved from the database on
the current request; only a *request-scoped* memo (attached to the user
instance) is used. There is deliberately no cross-request permission cache.
"""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from .catalog import REGISTERED_CODES, is_registered
from .models import Permission, UserPermissionOverride

_MEMO_ATTR = "_effective_permission_codes"


def _active_role_permission_codes(user) -> set[str]:
    now = timezone.now()
    rows = (
        Permission.objects.filter(
            is_active=True,
            role_permissions__role__is_active=True,
            role_permissions__role__deleted_at__isnull=True,
            role_permissions__role__user_roles__user=user,
        )
        .filter(
            Q(role_permissions__role__user_roles__expires_at__isnull=True)
            | Q(role_permissions__role__user_roles__expires_at__gt=now)
        )
        .values_list("code", flat=True)
        .distinct()
    )
    return {code for code in rows if is_registered(code)}


def _user_override_effects(user) -> dict[str, str]:
    rows = UserPermissionOverride.objects.filter(
        user=user, permission__is_active=True
    ).values_list("permission__code", "effect")
    return {code: effect for code, effect in rows if is_registered(code)}


def get_effective_permissions(user) -> frozenset[str]:
    """Return the set of effective permission codes for ``user``.

    Deny by default. Inactive / soft-deleted users have no permissions.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return frozenset()
    if not user.is_active or user.deleted_at is not None:
        return frozenset()

    cached = getattr(user, _MEMO_ATTR, None)
    if cached is not None:
        return cached

    if user.is_protected_admin:
        result = frozenset(REGISTERED_CODES)
        setattr(user, _MEMO_ATTR, result)
        return result

    codes = _active_role_permission_codes(user)
    overrides = _user_override_effects(user)

    for code, effect in overrides.items():
        if effect == UserPermissionOverride.Effect.DENY:
            codes.discard(code)
        elif effect == UserPermissionOverride.Effect.ALLOW:
            codes.add(code)

    result = frozenset(codes)
    setattr(user, _MEMO_ATTR, result)
    return result


def has_permission(user, code: str) -> bool:
    if not code or not is_registered(code):
        return False
    return code in get_effective_permissions(user)


def permissions_from_overrides(user, overrides) -> frozenset[str]:
    """Effective codes if ``overrides`` replaced this user's stored rows.

    ``overrides`` is an iterable of ``(code, effect)``. Inactive users still
    receive nothing. The protected administrator still receives every
    registered code.
    """
    if user is None or not getattr(user, "is_authenticated", True):
        return frozenset()
    if not user.is_active or user.deleted_at is not None:
        return frozenset()
    if user.is_protected_admin:
        return frozenset(REGISTERED_CODES)

    codes = _active_role_permission_codes(user)
    for code, effect in overrides:
        if not is_registered(code):
            continue
        if effect == UserPermissionOverride.Effect.DENY:
            codes.discard(code)
        elif effect == UserPermissionOverride.Effect.ALLOW:
            codes.add(code)
    return frozenset(codes)


def can_grant_permissions(actor, codes) -> bool:
    """True when ``actor`` holds every code in ``codes`` (no escalation)."""
    actor_codes = get_effective_permissions(actor)
    return all(code in actor_codes for code in codes)


def permissions_snapshot(user) -> dict:
    codes = sorted(get_effective_permissions(user))
    return {
        "permissions": codes,
        "is_protected_admin": bool(getattr(user, "is_protected_admin", False)),
    }


def describe_access(user) -> dict:
    """Role grants, stored overrides, and effective permissions for one user.

    ``effective`` uses :func:`get_effective_permissions`. Callers must not
    recompute it. A missing override means INHERIT.
    """
    role_codes = _active_role_permission_codes(user)
    overrides = _user_override_effects(user)
    effective = get_effective_permissions(user)
    now = timezone.now()
    roles = [
        {"id": row.role_id, "code": row.role.code, "name": row.role.name}
        for row in user.user_roles.select_related("role").filter(
            role__deleted_at__isnull=True,
            role__is_active=True,
        )
        if row.expires_at is None or row.expires_at > now
    ]
    permissions = []
    for perm in Permission.objects.filter(is_active=True).order_by("resource", "code"):
        if not is_registered(perm.code):
            continue
        permissions.append(
            {
                "code": perm.code,
                "resource": perm.resource,
                "action": perm.action,
                "description": perm.description,
                "from_role": perm.code in role_codes,
                "override": overrides.get(perm.code),
                "effective": perm.code in effective,
            }
        )
    return {
        "user_id": user.pk,
        "username": user.username,
        "is_active": user.is_active,
        "is_protected_admin": bool(user.is_protected_admin),
        "roles": roles,
        "permissions": permissions,
    }
