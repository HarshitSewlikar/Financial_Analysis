"""Registered permission catalog.

A ``Permission`` row in MySQL is only *effective* if its ``code`` appears in
this catalog. This prevents creating new capabilities by inserting rows.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PermissionDefinition:
    code: str
    resource: str
    action: str
    description: str


REGISTERED_PERMISSIONS: tuple[PermissionDefinition, ...] = (
    PermissionDefinition("users.read", "users", "read", "View users"),
    PermissionDefinition("users.create", "users", "create", "Create users"),
    PermissionDefinition("users.update", "users", "update", "Update users"),
    PermissionDefinition(
        "users.deactivate", "users", "deactivate", "Deactivate users"
    ),
    PermissionDefinition("roles.read", "roles", "read", "View roles"),
    PermissionDefinition("roles.manage", "roles", "manage", "Create/update roles"),
    PermissionDefinition("roles.assign", "roles", "assign", "Assign roles to users"),
    PermissionDefinition(
        "permissions.read", "permissions", "read", "View permission definitions"
    ),
    PermissionDefinition(
        "permissions.manage",
        "permissions",
        "manage",
        "Create/update permission definitions",
    ),
    PermissionDefinition(
        "permissions.assign",
        "permissions",
        "assign",
        "Assign permissions to roles / user overrides",
    ),
    PermissionDefinition("menus.read", "menus", "read", "View menus"),
    PermissionDefinition("menus.manage", "menus", "manage", "Create/update menus"),
    PermissionDefinition(
        "menus.assign", "menus", "assign", "Assign menus to roles"
    ),
    PermissionDefinition("todos.read", "todos", "read", "View to-dos in scope"),
    PermissionDefinition("todos.create", "todos", "create", "Create to-dos"),
    PermissionDefinition("todos.update", "todos", "update", "Update to-dos"),
    PermissionDefinition("todos.delete", "todos", "delete", "Delete to-dos"),
    PermissionDefinition("todos.assign", "todos", "assign", "Assign to-dos"),
    PermissionDefinition(
        "todos.manage",
        "todos",
        "manage",
        "See and manage all to-dos regardless of ownership",
    ),
    PermissionDefinition("audit.read", "audit", "read", "View audit logs"),
    PermissionDefinition("audit.export", "audit", "export", "Export audit logs"),
    PermissionDefinition(
        "market.read", "market", "read", "Access market/finance data"
    ),
)

REGISTERED_CODES: frozenset = frozenset(
    definition.code for definition in REGISTERED_PERMISSIONS
)


def is_registered(code: str) -> bool:
    return code in REGISTERED_CODES


# System roles seeded by the ``seed_rbac`` management command.
SYSTEM_ROLE_DEFINITIONS: tuple[dict, ...] = (
    {
        "code": "administrator",
        "name": "Administrator",
        "description": "Full administrative access to all application capabilities.",
        "permissions": sorted(REGISTERED_CODES),
    },
    {
        "code": "auditor",
        "name": "Auditor",
        "description": "Read-only access to audit records and finance data.",
        "permissions": [
            "audit.read",
            "audit.export",
            "users.read",
            "roles.read",
            "permissions.read",
            "menus.read",
            "market.read",
        ],
    },
    {
        "code": "standard_user",
        "name": "Standard user",
        "description": "Can manage their own to-dos and view market data.",
        "permissions": [
            "todos.read",
            "todos.create",
            "todos.update",
            "todos.delete",
            "todos.assign",
            "market.read",
        ],
    },
)
