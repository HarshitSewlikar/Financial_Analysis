"""Allowlisted frontend component keys.

The database may only reference these keys. The frontend maps them to real
components; unknown keys render a controlled configuration error.
"""

ALLOWED_COMPONENT_KEYS = frozenset(
    {
        "DashboardPage",
        "TodosPage",
        "UsersAdminPage",
        "RolesAdminPage",
        "PermissionsAdminPage",
        "MenusAdminPage",
        "AuditPage",
    }
)
