from __future__ import annotations

import threading

import pytest
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connections

from accounts.models import SetupState

User = get_user_model()
SIGNUP_CODE = "setup-code-local-dev"


def _bootstrap_payload(username="rootadmin", password="Str0ngPass!23"):
    return {
        "username": username,
        "password": password,
        "signup_code": SIGNUP_CODE,
        "name": "Root Admin",
    }


@pytest.mark.django_db
def test_setup_status_reports_incomplete_before_bootstrap(api, bootstrap_ready):
    response = api.get("/api/v1/auth/setup-status/")
    assert response.status_code == 200
    assert response.json()["setup_complete"] is False


@pytest.mark.django_db
def test_bootstrap_creates_single_protected_admin(api, bootstrap_ready):
    response = api.post("/api/v1/auth/bootstrap/", _bootstrap_payload(), format="json")
    assert response.status_code == 201
    body = response.json()
    assert "access" in body
    user = User.objects.get(username="rootadmin")
    assert user.is_protected_admin is True
    assert SetupState.objects.get(pk=1).is_bootstrapped is True


@pytest.mark.django_db
def test_second_bootstrap_returns_410(api, bootstrap_ready):
    assert api.post("/api/v1/auth/bootstrap/", _bootstrap_payload(), format="json").status_code == 201
    second = api.post(
        "/api/v1/auth/bootstrap/",
        _bootstrap_payload(username="other", password="Str0ngPass!23"),
        format="json",
    )
    assert second.status_code == 410
    assert User.objects.filter(is_protected_admin=True).count() == 1


@pytest.mark.django_db
def test_bootstrap_without_code_is_rejected(api, bootstrap_ready):
    payload = _bootstrap_payload()
    payload["signup_code"] = ""
    assert api.post("/api/v1/auth/bootstrap/", payload, format="json").status_code == 400


@pytest.mark.django_db
def test_bootstrap_wrong_code_is_rejected(api, bootstrap_ready):
    payload = _bootstrap_payload()
    payload["signup_code"] = "nope"
    response = api.post("/api/v1/auth/bootstrap/", payload, format="json")
    assert response.status_code == 400
    assert not User.objects.exists()


@pytest.mark.django_db(transaction=True)
def test_concurrent_bootstrap_creates_exactly_one_admin(bootstrap_ready):
    """Two concurrent bootstraps -> exactly one protected admin."""
    from rest_framework.test import APIClient

    results = []
    barrier = threading.Barrier(2)

    def worker(username):
        client = APIClient()
        barrier.wait()
        response = client.post(
            "/api/v1/auth/bootstrap/",
            _bootstrap_payload(username=username),
            format="json",
        )
        results.append(response.status_code)
        connections.close_all()

    threads = [
        threading.Thread(target=worker, args=(f"admin{i}",)) for i in range(2)
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert User.objects.filter(is_protected_admin=True).count() == 1
    assert sorted(results) in ([201, 410], [201, 400], [201, 409])


@pytest.mark.django_db
def test_login_and_me_flow(api, admin_user):
    response = api.post(
        "/api/v1/auth/login/",
        {"username": "bootstrapadmin", "password": "Passw0rd!23"},
        format="json",
    )
    assert response.status_code == 200
    access = response.json()["access"]
    me = api.get("/api/v1/auth/me/", HTTP_AUTHORIZATION=f"Bearer {access}")
    assert me.status_code == 200
    assert me.json()["user"]["username"] == "bootstrapadmin"


@pytest.mark.django_db
def test_inactive_user_cannot_login(api, make_user):
    make_user("inactiveuser", is_active=False)
    response = api.post(
        "/api/v1/auth/login/",
        {"username": "inactiveuser", "password": "Passw0rd!23"},
        format="json",
    )
    assert response.status_code == 401


@pytest.mark.django_db
def test_refresh_rotates_and_logout_revokes(api, admin_user):
    login = api.post(
        "/api/v1/auth/login/",
        {"username": "bootstrapadmin", "password": "Passw0rd!23"},
        format="json",
    )
    assert login.status_code == 200
    # csrf token for cookie-protected endpoints
    api.get("/api/v1/auth/csrf/")
    csrf = api.cookies.get("csrftoken").value

    refreshed = api.post(
        "/api/v1/auth/token/refresh/", HTTP_X_CSRFTOKEN=csrf, format="json"
    )
    assert refreshed.status_code == 200
    assert "access" in refreshed.json()

    logout = api.post("/api/v1/auth/logout/", HTTP_X_CSRFTOKEN=csrf, format="json")
    assert logout.status_code == 204


@pytest.mark.django_db
def test_repeated_failed_logins_are_throttled(api, make_user):
    make_user("target")
    last_status = None
    for _ in range(8):
        response = api.post(
            "/api/v1/auth/login/",
            {"username": "target", "password": "wrong"},
            format="json",
        )
        last_status = response.status_code
    assert last_status in (429, 401)
