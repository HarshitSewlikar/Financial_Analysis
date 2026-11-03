from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

from access_control.models import Permission, Role, RolePermission, UserPermissionOverride, UserRole

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


def _rows(payload):
    return {row["code"]: row for row in payload["access"]["permissions"]}


@pytest.mark.django_db
def test_access_matrix_allow_deny_and_inherit(api, seeded, make_user):
    before_roles = set(Role.objects.filter(is_system=True).values_list("code", flat=True))
    actor_role = make_role(
        "accessclerk",
        ["permissions.read", "permissions.assign", "users.read", "audit.read"],
    )
    actor = make_user("accessclerk", roles=())
    assign(actor, actor_role)
    target = make_user("targetuser", roles=())
    assign(target, make_role("targetrole", ["users.read"]))
    path = f"/api/v1/users/{target.pk}/permission-overrides/"

    stranger = make_user("stranger", roles=())
    api.force_authenticate(user=stranger)
    assert api.get(path).status_code == 403

    api.force_authenticate(user=actor)
    loaded = api.get(path)
    assert loaded.status_code == 200
    initial = _rows(loaded.json())
    assert initial["users.read"] == {
        **initial["users.read"],
        "from_role": True,
        "override": None,
        "effective": True,
    }
    assert initial["audit.read"]["from_role"] is False
    assert initial["audit.read"]["effective"] is False

    allowed = api.put(
        path,
        {"overrides": [{"permission_code": "audit.read", "effect": "ALLOW"}]},
        format="json",
    )
    assert allowed.status_code == 200
    assert _rows(allowed.json())["audit.read"]["override"] == "ALLOW"
    assert _rows(allowed.json())["audit.read"]["effective"] is True
    assert UserPermissionOverride.objects.filter(user=target, effect="ALLOW").count() == 1

    denied = api.put(
        path,
        {
            "overrides": [
                {"permission_code": "audit.read", "effect": "ALLOW"},
                {"permission_code": "users.read", "effect": "DENY"},
            ]
        },
        format="json",
    )
    assert denied.status_code == 200
    denied_rows = _rows(denied.json())
    assert denied_rows["users.read"]["from_role"] is True
    assert denied_rows["users.read"]["override"] == "DENY"
    assert denied_rows["users.read"]["effective"] is False

    reset = api.put(path, {"overrides": []}, format="json")
    assert reset.status_code == 200
    reset_rows = _rows(reset.json())
    assert reset_rows["users.read"]["override"] is None
    assert reset_rows["users.read"]["effective"] is True
    assert UserPermissionOverride.objects.filter(user=target).count() == 0
    assert set(Role.objects.filter(is_system=True).values_list("code", flat=True)) == before_roles


@pytest.mark.django_db
def test_protected_admin_keeps_effective_access(api, seeded, admin_user):
    api.force_authenticate(user=admin_user)
    path = f"/api/v1/users/{admin_user.pk}/permission-overrides/"
    loaded = api.get(path)
    assert loaded.status_code == 200
    body = loaded.json()["access"]
    assert body["is_protected_admin"] is True
    assert all(row["effective"] for row in body["permissions"])
    blocked = api.put(
        path,
        {"overrides": [{"permission_code": "audit.read", "effect": "DENY"}]},
        format="json",
    )
    assert blocked.status_code == 403
    assert UserPermissionOverride.objects.filter(user=admin_user).count() == 0


def _menu_codes(items):
    codes = []
    for item in items:
        codes.append(item["code"])
        codes.extend(_menu_codes(item.get("children") or []))
    return codes


@pytest.mark.django_db
def test_roles_and_users_share_access_configuration(api, seeded, admin_user, make_user):
    from navigation.models import Menu, RoleMenu

    api.force_authenticate(user=admin_user)
    sidebar = _menu_codes(api.get("/api/v1/auth/me/access/").json()["menus"])
    assert "roles" in sidebar
    assert "users" in sidebar
    assert "permissions" not in sidebar
    assert "menus" not in sidebar
    admin_role = Role.objects.get(code="administrator")
    admin_menu_codes = set(
        RoleMenu.objects.filter(role=admin_role).values_list("menu__code", flat=True)
    )
    assert {"permissions", "menus"}.isdisjoint(admin_menu_codes)

    created = api.post(
        "/api/v1/roles/",
        {"code": "desk", "name": "Desk", "description": "Temporary"},
        format="json",
    )
    assert created.status_code == 201
    role_id = created.json()["id"]
    assert api.put(
        f"/api/v1/roles/{role_id}/permissions/",
        {"permission_codes": ["todos.read"]},
        format="json",
    ).status_code == 200
    todos = Menu.objects.get(code="todos")
    assert api.put(
        f"/api/v1/roles/{role_id}/menus/",
        {"menu_ids": [todos.id]},
        format="json",
    ).status_code == 200
    reloaded = api.get(f"/api/v1/roles/{role_id}/")
    assert reloaded.status_code == 200
    assert reloaded.json()["permission_codes"] == ["todos.read"]
    assert api.get(f"/api/v1/roles/{role_id}/menus/").json()["menu_ids"] == [todos.id]
    assert RolePermission.objects.filter(role_id=role_id).count() == 1
    assert RoleMenu.objects.filter(role_id=role_id, menu=todos).count() == 1

    target = make_user("deskuser", roles=())
    assign(target, Role.objects.get(pk=role_id))
    path = f"/api/v1/users/{target.pk}/permission-overrides/"
    loaded = api.get(path)
    assert loaded.status_code == 200
    menu_rows = {row["code"]: row for row in loaded.json()["access"]["menus"]}
    assert menu_rows["todos"]["from_role"] is True
    assert menu_rows["todos"]["effective"] is True
    assert menu_rows["users"]["from_role"] is False
    assert menu_rows["users"]["effective"] is False

    denied = api.put(
        path,
        {"overrides": [{"permission_code": "todos.read", "effect": "DENY"}]},
        format="json",
    )
    assert denied.status_code == 200
    denied_menus = {row["code"]: row for row in denied.json()["access"]["menus"]}
    assert denied_menus["todos"]["from_role"] is True
    assert denied_menus["todos"]["effective"] is False
    assert UserPermissionOverride.objects.filter(user=target, effect="DENY").count() == 1

    stranger = make_user("outsider", roles=())
    api.force_authenticate(user=stranger)
    assert api.put(
        f"/api/v1/roles/{role_id}/menus/",
        {"menu_ids": [todos.id]},
        format="json",
    ).status_code == 403


def _perm(payload, code):
    return next(row for row in payload["access"]["permissions"] if row["code"] == code)


@pytest.mark.django_db
def test_user_checkbox_overrides_change_api_access(api, seeded, admin_user, make_user):
    target = make_user("boxuser", roles=("standard_user",))
    path = f"/api/v1/users/{target.pk}/permission-overrides/"
    api.force_authenticate(user=admin_user)

    stranger = make_user("noperm", roles=())
    api.force_authenticate(user=stranger)
    assert api.put(
        path,
        {"overrides": [{"permission_code": "audit.read", "effect": "ALLOW"}]},
        format="json",
    ).status_code == 403

    clerk = make_user("permclerk", roles=())
    assign(
        clerk,
        make_role(
            "permclerk",
            ["permissions.assign", "audit.read", "market.read"],
        ),
    )
    api.force_authenticate(user=clerk)
    blocked = api.put(
        path,
        {"overrides": [{"permission_code": "users.read", "effect": "ALLOW"}]},
        format="json",
    )
    assert blocked.status_code == 403
    assert UserPermissionOverride.objects.filter(user=target).count() == 0

    allowed = api.put(
        path,
        {"overrides": [{"permission_code": "audit.read", "effect": "ALLOW"}]},
        format="json",
    )
    assert allowed.status_code == 200
    assert _perm(allowed.json(), "audit.read")["effective"] is True
    assert _perm(allowed.json(), "audit.read")["from_role"] is False
    assert UserPermissionOverride.objects.get(user=target).effect == "ALLOW"

    api.force_authenticate(user=User.objects.get(pk=target.pk))
    assert api.get("/api/v1/audit-logs/").status_code == 200
    assert api.get("/api/v1/market/movers/").status_code == 200

    api.force_authenticate(user=clerk)
    denied = api.put(
        path,
        {"overrides": [{"permission_code": "market.read", "effect": "DENY"}]},
        format="json",
    )
    assert denied.status_code == 200
    assert UserPermissionOverride.objects.get(user=target, permission__code="market.read").effect == "DENY"
    assert _perm(denied.json(), "market.read")["from_role"] is True
    assert _perm(denied.json(), "market.read")["effective"] is False

    api.force_authenticate(user=User.objects.get(pk=target.pk))
    assert api.get("/api/v1/market/movers/").status_code == 403
    assert api.get("/api/v1/audit-logs/").status_code == 403

    api.force_authenticate(user=clerk)
    reset = api.put(path, {"overrides": []}, format="json")
    assert reset.status_code == 200
    assert UserPermissionOverride.objects.filter(user=target).count() == 0
    assert _perm(reset.json(), "market.read")["effective"] is True
    assert _perm(reset.json(), "audit.read")["effective"] is False

    api.force_authenticate(user=User.objects.get(pk=target.pk))
    assert api.get("/api/v1/market/movers/").status_code == 200


@pytest.mark.django_db
def test_clearing_a_deny_cannot_escalate(api, seeded, make_user):
    actor = make_user("selfclerk", roles=())
    assign(actor, make_role("selfclerk", ["permissions.assign", "users.read"]))
    UserPermissionOverride.objects.create(
        user=actor,
        permission=Permission.objects.get(code="users.read"),
        effect="DENY",
    )
    path = f"/api/v1/users/{actor.pk}/permission-overrides/"
    api.force_authenticate(user=actor)
    response = api.put(path, {"overrides": []}, format="json")
    assert response.status_code == 403
    assert UserPermissionOverride.objects.filter(user=actor, effect="DENY").count() == 1
    assert api.get("/api/v1/users/").status_code == 403


def _access_menus(api):
    return _menu_codes(api.get("/api/v1/auth/me/access/").json()["menus"])


@pytest.mark.django_db
def test_role_and_user_menu_overrides_change_visibility(api, seeded, admin_user, make_user):
    from navigation.models import Menu, UserMenuOverride

    role = make_role("deskrole", ["market.read", "todos.read"])
    dashboard = Menu.objects.get(code="dashboard")
    todos = Menu.objects.get(code="todos")
    audit = Menu.objects.get(code="audit")
    api.force_authenticate(user=admin_user)
    assert api.put(
        f"/api/v1/roles/{role.pk}/menus/",
        {"menu_ids": [dashboard.id]},
        format="json",
    ).status_code == 200

    target = make_user("menuuser", roles=())
    assign(target, role)
    api.force_authenticate(user=User.objects.get(pk=target.pk))
    assert _access_menus(api) == ["dashboard"]
    assert api.get("/api/v1/todos/").status_code == 200

    api.force_authenticate(user=admin_user)
    assert api.put(
        f"/api/v1/roles/{role.pk}/menus/",
        {"menu_ids": [dashboard.id, todos.id]},
        format="json",
    ).status_code == 200
    api.force_authenticate(user=User.objects.get(pk=target.pk))
    assert set(_access_menus(api)) == {"dashboard", "todos"}

    stranger = make_user("nomenus", roles=())
    api.force_authenticate(user=stranger)
    menu_path = f"/api/v1/users/{target.pk}/menu-overrides/"
    assert api.put(
        menu_path,
        {"overrides": [{"menu_code": "audit", "effect": "SHOW"}]},
        format="json",
    ).status_code == 403

    clerk = make_user("menuclerk", roles=())
    assign(clerk, make_role("menuclerk", ["menus.assign", "market.read", "todos.read"]))
    api.force_authenticate(user=clerk)
    blocked = api.put(
        menu_path,
        {"overrides": [{"menu_code": "audit", "effect": "SHOW"}]},
        format="json",
    )
    assert blocked.status_code == 403
    assert UserMenuOverride.objects.filter(user=target).count() == 0

    api.force_authenticate(user=admin_user)
    shown = api.put(
        menu_path,
        {"overrides": [{"menu_code": "audit", "effect": "SHOW"}]},
        format="json",
    )
    assert shown.status_code == 200
    assert UserMenuOverride.objects.get(user=target, menu=audit).effect == "SHOW"
    audit_row = next(row for row in shown.json()["access"]["menus"] if row["code"] == "audit")
    assert audit_row["from_role"] is False
    assert audit_row["override"] == "SHOW"
    assert audit_row["effective"] is True

    hidden = api.put(
        menu_path,
        {
            "overrides": [
                {"menu_code": "audit", "effect": "SHOW"},
                {"menu_code": "todos", "effect": "HIDE"},
            ]
        },
        format="json",
    )
    assert hidden.status_code == 200
    api.force_authenticate(user=User.objects.get(pk=target.pk))
    visible = set(_access_menus(api))
    assert "audit" in visible
    assert "todos" not in visible
    assert "dashboard" in visible
    assert api.get("/api/v1/audit-logs/").status_code == 403
    assert api.get("/api/v1/todos/").status_code == 200

    api.force_authenticate(user=admin_user)
    reset = api.put(menu_path, {"overrides": []}, format="json")
    assert reset.status_code == 200
    assert UserMenuOverride.objects.filter(user=target).count() == 0
    api.force_authenticate(user=User.objects.get(pk=target.pk))
    assert set(_access_menus(api)) == {"dashboard", "todos"}


@pytest.mark.django_db
def test_role_change_keeps_individual_overrides(api, seeded, admin_user, make_user):
    from navigation.models import UserMenuOverride

    target = make_user("mover", roles=("standard_user",))
    api.force_authenticate(user=admin_user)
    assert api.put(
        f"/api/v1/users/{target.pk}/permission-overrides/",
        {"overrides": [{"permission_code": "users.read", "effect": "ALLOW"}]},
        format="json",
    ).status_code == 200
    assert api.put(
        f"/api/v1/users/{target.pk}/menu-overrides/",
        {"overrides": [{"menu_code": "audit", "effect": "SHOW"}]},
        format="json",
    ).status_code == 200

    replacement = make_role("marketonly", ["market.read"])
    assert api.put(
        f"/api/v1/users/{target.pk}/roles/",
        {"role_ids": [replacement.pk]},
        format="json",
    ).status_code == 200

    loaded = api.get(f"/api/v1/users/{target.pk}/permission-overrides/")
    assert loaded.status_code == 200
    assert _perm(loaded.json(), "users.read")["from_role"] is False
    assert _perm(loaded.json(), "users.read")["override"] == "ALLOW"
    assert _perm(loaded.json(), "users.read")["effective"] is True
    assert _perm(loaded.json(), "todos.read")["effective"] is False
    audit_row = next(row for row in loaded.json()["access"]["menus"] if row["code"] == "audit")
    assert audit_row["override"] == "SHOW"
    assert audit_row["effective"] is True
    assert UserPermissionOverride.objects.filter(user=target, effect="ALLOW").count() == 1
    assert UserMenuOverride.objects.filter(user=target, effect="SHOW").count() == 1
