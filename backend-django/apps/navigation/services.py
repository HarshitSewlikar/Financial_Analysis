"""Build the visible navigation menu tree for a user."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from access_control import policy

from .models import Menu, UserMenuOverride


def _role_menu_codes(user) -> set[str]:
    now = timezone.now()
    return set(
        Menu.objects.filter(
            is_active=True,
            role_menus__role__is_active=True,
            role_menus__role__deleted_at__isnull=True,
            role_menus__role__user_roles__user=user,
        )
        .filter(
            Q(role_menus__role__user_roles__expires_at__isnull=True)
            | Q(role_menus__role__user_roles__expires_at__gt=now)
        )
        .values_list("code", flat=True)
        .distinct()
    )


def _menu_override_effects(user) -> dict[str, str]:
    if getattr(user, "is_protected_admin", False):
        return {}
    rows = UserMenuOverride.objects.filter(
        user=user, menu__is_active=True
    ).values_list("menu__code", "effect")
    return dict(rows)


def effective_menu_codes(user) -> set[str]:
    """Menus this user should see.

    The role supplies the default. SHOW and HIDE replace that default for one
    menu. An inherited menu still stays hidden when its required permission is
    missing. An explicit SHOW is visibility only; it does not grant the API.
    """
    if not user or not getattr(user, "is_authenticated", False):
        return set()
    if not user.is_active or user.deleted_at:
        return set()

    granted = _role_menu_codes(user)
    overrides = _menu_override_effects(user)
    visible = set()
    for menu in Menu.objects.filter(is_active=True):
        effect = overrides.get(menu.code)
        if effect == UserMenuOverride.Effect.HIDE:
            continue
        if effect == UserMenuOverride.Effect.SHOW:
            visible.add(menu.code)
            continue
        if menu.code not in granted:
            continue
        if menu.required_permission and not policy.has_permission(
            user, menu.required_permission
        ):
            continue
        visible.add(menu.code)
    return visible


def visible_menus_for(user) -> list[dict]:
    codes = effective_menu_codes(user)
    allowed = list(
        Menu.objects.filter(is_active=True, code__in=codes).order_by(
            "sort_order", "label"
        )
    )

    by_parent: dict = {}
    for menu in allowed:
        by_parent.setdefault(menu.parent_id, []).append(menu)

    def build(parent_id):
        items = []
        for menu in by_parent.get(parent_id, []):
            child_items = build(menu.id)
            item = {
                "code": menu.code,
                "label": menu.label,
                "path": menu.path,
                "component_key": menu.component_key,
                "sort_order": menu.sort_order,
            }
            if child_items:
                item["children"] = child_items
            items.append(item)
        return items

    return build(None)


def describe_menu_access(user) -> list[dict]:
    """Role menu grants, stored overrides, and the menus this user can open."""
    granted = _role_menu_codes(user) if user and user.is_active and not user.deleted_at else set()
    overrides = _menu_override_effects(user) if user else {}
    effective = effective_menu_codes(user)
    rows = []
    for menu in Menu.objects.filter(is_active=True).order_by("sort_order", "label"):
        rows.append(
            {
                "id": menu.id,
                "code": menu.code,
                "label": menu.label,
                "path": menu.path,
                "required_permission": menu.required_permission,
                "from_role": menu.code in granted,
                "override": overrides.get(menu.code),
                "effective": menu.code in effective,
            }
        )
    return rows
