"""Idempotent seeding of system roles, permissions and menus."""

from __future__ import annotations

from django.db import transaction

from .catalog import REGISTERED_PERMISSIONS, SYSTEM_ROLE_DEFINITIONS
from .models import Permission, Role, RolePermission

MENU_DEFINITIONS = [
    {
        "code": "dashboard",
        "label": "Dashboard",
        "path": "/dashboard",
        "component_key": "DashboardPage",
        "required_permission": "market.read",
        "sort_order": 10,
    },
    {
        "code": "todos",
        "label": "To-dos",
        "path": "/todos",
        "component_key": "TodosPage",
        "required_permission": "todos.read",
        "sort_order": 20,
    },
    {
        "code": "users",
        "label": "Users",
        "path": "/admin/users",
        "component_key": "UsersAdminPage",
        "required_permission": "users.read",
        "sort_order": 30,
    },
    {
        "code": "roles",
        "label": "Roles",
        "path": "/admin/roles",
        "component_key": "RolesAdminPage",
        "required_permission": "roles.read",
        "sort_order": 40,
    },
    {
        "code": "permissions",
        "label": "Permissions",
        "path": "/admin/permissions",
        "component_key": "PermissionsAdminPage",
        "required_permission": "permissions.read",
        "sort_order": 50,
    },
    {
        "code": "menus",
        "label": "Menus",
        "path": "/admin/menus",
        "component_key": "MenusAdminPage",
        "required_permission": "menus.read",
        "sort_order": 60,
    },
    {
        "code": "audit",
        "label": "Audit Log",
        "path": "/admin/audit",
        "component_key": "AuditPage",
        "required_permission": "audit.read",
        "sort_order": 70,
    },
]

ROLE_MENUS = {
    "administrator": [m["code"] for m in MENU_DEFINITIONS],
    "auditor": [
        "dashboard",
        "users",
        "roles",
        "permissions",
        "menus",
        "audit",
    ],
    "standard_user": ["dashboard", "todos"],
}


@transaction.atomic
def seed_rbac() -> dict:
    """Create/refresh registered permissions and system roles."""
    from navigation.models import Menu, RoleMenu

    created_permissions = {}
    for definition in REGISTERED_PERMISSIONS:
        permission, _ = Permission.objects.update_or_create(
            code=definition.code,
            defaults={
                "resource": definition.resource,
                "action": definition.action,
                "description": definition.description,
                "is_system": True,
                "is_active": True,
            },
        )
        created_permissions[definition.code] = permission

    roles = {}
    for role_def in SYSTEM_ROLE_DEFINITIONS:
        role, _ = Role.objects.update_or_create(
            code=role_def["code"],
            defaults={
                "name": role_def["name"],
                "description": role_def["description"],
                "is_system": True,
                "is_active": True,
            },
        )
        for code in role_def["permissions"]:
            permission = created_permissions.get(code)
            if permission is None:
                continue
            RolePermission.objects.get_or_create(role=role, permission=permission)
        roles[role.code] = role

    menus = {}
    for menu_def in MENU_DEFINITIONS:
        menu, _ = Menu.objects.update_or_create(
            code=menu_def["code"],
            defaults={
                "label": menu_def["label"],
                "path": menu_def["path"],
                "component_key": menu_def["component_key"],
                "required_permission": menu_def["required_permission"],
                "sort_order": menu_def["sort_order"],
                "is_active": True,
            },
        )
        menus[menu.code] = menu

    for role_code, menu_codes in ROLE_MENUS.items():
        role = roles.get(role_code)
        if role is None:
            continue
        for menu_code in menu_codes:
            menu = menus.get(menu_code)
            if menu is not None:
                RoleMenu.objects.get_or_create(role=role, menu=menu)

    return {"roles": roles, "permissions": created_permissions, "menus": menus}
