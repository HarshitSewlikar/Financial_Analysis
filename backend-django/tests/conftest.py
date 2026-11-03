"""Shared pytest fixtures for the Django backend tests."""

from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from access_control.models import Role, UserRole
from access_control.seed import seed_rbac
from accounts.models import SetupState

User = get_user_model()


@pytest.fixture
def api() -> APIClient:
    return APIClient()


@pytest.fixture(autouse=True)
def _clear_caches():
    """Clear locmem caches so throttling/market data do not leak across tests."""
    from django.core.cache import caches

    for alias in caches:
        caches[alias].clear()
    yield


@pytest.fixture
def seeded(db):
    return seed_rbac()


@pytest.fixture
def make_user(db):
    def _make(username, password="Passw0rd!23", roles=("standard_user",), **extra):
        user = User.objects.create_user(username=username, password=password, **extra)
        for role_code in roles:
            role = Role.objects.filter(code=role_code).first()
            if role:
                UserRole.objects.get_or_create(user=user, role=role)
        return user

    return _make


@pytest.fixture
def admin_user(make_user):
    return make_user("bootstrapadmin", roles=("administrator",), is_protected_admin=True)


@pytest.fixture
def auth_api(api, make_user):
    """Return ``(client, user)`` authenticated as a standard user via force_login."""

    def _factory(username="alice", roles=("standard_user",), **extra):
        user = make_user(username, roles=roles, **extra)
        api.force_authenticate(user=user)
        return api, user

    return _factory


def _login(api, username, password):
    response = api.post(
        "/api/v1/auth/login/",
        {"username": username, "password": password},
        format="json",
    )
    return response


@pytest.fixture
def login():
    return _login


@pytest.fixture
def bootstrap_ready(db, seeded):
    state = SetupState.objects.get(pk=1)
    state.is_bootstrapped = False
    state.save(update_fields=["is_bootstrapped"])
    return state
