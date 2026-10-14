"""Build the visible navigation menu tree for a user."""

from __future__ import annotations

from django.db.models import Q
from django.utils import timezone

from access_control import policy

from .models import Menu


def _visible_menu_qs(user):
    now = timezone.now()
    return (
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
        .distinct()
    )


def visible_menus_for(user) -> list[dict]:
    if not user or not user.is_authenticated or not user.is_active or user.deleted_at:
        return []
    if user.is_protected_admin:
        qs = Menu.objects.filter(is_active=True).distinct()
    else:
        qs = _visible_menu_qs(user)

    allowed = []
    for menu in qs.order_by("sort_order", "label"):
        if menu.required_permission and not policy.has_permission(
            user, menu.required_permission
        ):
            continue
        allowed.append(menu)

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
