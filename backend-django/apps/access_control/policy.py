"""The single authoritative effective-permission resolver.

All authorization decisions must go through this module. Nothing else may
compute effective permissions. Permissions are always resolved from MySQL on
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
