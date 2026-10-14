from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from access_control.models import Permission, Role, RolePermission, UserRole

User = get_user_model()


def make_role(code, permission_codes):
    role = Role.objects.create(code=code, name=code, is_system=False)
    for perm_code in permission_codes:
        permission = Permission.objects.get(code=perm_code)
        RolePermission.objects.create(role=role, permission=permission)
    return role


def assign(user, role):
    UserRole.objects.create(user=user, role=role)


@pytest.mark.django_db
def test_missing_permission_returns_403(api, seeded, make_user):
    user = make_user("nobody", roles=())  # no roles -> no permissions
    api.force_authenticate(user=user)
    assert api.get("/api/v1/users/").status_code == 403
    assert api.get("/api/v1/audit-logs/").status_code == 403
    assert api.get("/api/v1/market/movers/").status_code == 403


@pytest.mark.django_db
def test_standard_user_can_read_market_but_not_users(api, seeded, make_user):
    user = make_user("std", roles=("standard_user",))
    api.force_authenticate(user=user)
    assert api.get("/api/v1/market/movers/").status_code == 200
    assert api.get("/api/v1/users/").status_code == 403


@pytest.mark.django_db
def test_menu_grant_does_not_authorize_api(api, seeded, make_user, admin_user):
    # A user WITHOUT users.read must still get 403 even if their role is mapped
    # to the Users menu. Menu visibility is separate from API authorization.
    from navigation.models import Menu, RoleMenu

    role = make_role("menu_only", ["market.read"])
    users_menu = Menu.objects.get(code="users")
    RoleMenu.objects.create(role=role, menu=users_menu)
    user = make_user("menuonly", roles=())
    assign(user, role)
    api.force_authenticate(user=user)

    access = api.get("/api/v1/auth/me/access/").json()
    # Even if the menu somehow appears, the API must remain protected.
    assert api.get("/api/v1/users/").status_code == 403
    assert "users.read" not in access["permissions"]


@pytest.mark.django_db
def test_actor_cannot_grant_permissions_they_do_not_hold(api, seeded, make_user):
    actor_role = make_role(
        "manager",
        ["permissions.read", "permissions.assign", "roles.read", "roles.assign"],
    )
    actor = make_user("manager1", roles=())
    assign(actor, actor_role)
    api.force_authenticate(user=actor)

    target_role = make_role("lowpriv", ["users.read"])
    response = api.put(
        f"/api/v1/roles/{target_role.pk}/permissions/",
        {"permission_codes": ["users.read", "audit.read"]},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_delegate_cannot_assign_role_beyond_authority(api, seeded, make_user):
    actor_role = make_role("manager2", ["roles.assign", "users.read"])
    actor = make_user("manager2", roles=())
    assign(actor, actor_role)
    target = make_user("target2", roles=())
    api.force_authenticate(user=actor)

    admin_role = Role.objects.get(code="administrator")
    response = api.put(
        f"/api/v1/users/{target.pk}/roles/",
        {"role_ids": [admin_role.pk]},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_protected_admin_cannot_be_modified_or_removed(api, seeded, admin_user, make_user):
    manager_role = make_role(
        "usermgr", ["users.read", "users.update", "users.deactivate"]
    )
    actor = make_user("usermgr1", roles=())
    assign(actor, manager_role)
    api.force_authenticate(user=actor)

    patch = api.patch(
        f"/api/v1/users/{admin_user.pk}/", {"name": "hacked"}, format="json"
    )
    assert patch.status_code == 403
    delete = api.delete(f"/api/v1/users/{admin_user.pk}/")
    assert delete.status_code == 403 or delete.status_code == 400


@pytest.mark.django_db
def test_final_administrator_cannot_be_deactivated(api, seeded, make_user):
    # Exactly one (non-protected) administrator: the last eligible admin.
    only_admin = make_user("onlyadmin", roles=("administrator",))
    manager_role = make_role(
        "usermgr2", ["users.read", "users.update", "users.deactivate"]
    )
    actor = make_user("usermgr2", roles=())
    assign(actor, manager_role)
    api.force_authenticate(user=actor)

    response = api.patch(
        f"/api/v1/users/{only_admin.pk}/", {"is_active": False}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_user_list_requires_and_respects_permission(api, seeded, make_user):
    actor = make_user("reader", roles=("auditor",))
    api.force_authenticate(user=actor)
    response = api.get("/api/v1/users/")
    assert response.status_code == 200
    assert "results" in response.json()
