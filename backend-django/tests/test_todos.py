from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.fixture
def todo_payload():
    return {"title": "Write report", "description": "Q3 report", "priority": "high"}


@pytest.mark.django_db
def test_user_sees_only_own_and_assigned_todos(api, seeded, make_user, todo_payload):
    alice = make_user("alice", roles=("standard_user",))
    bob = make_user("bob", roles=("standard_user",))

    api.force_authenticate(user=alice)
    created = api.post("/api/v1/todos/", todo_payload, format="json")
    assert created.status_code == 201
    todo_id = created.json()["id"]

    # bob sees nothing yet
    api.force_authenticate(user=bob)
    assert api.get("/api/v1/todos/").json()["count"] == 0

    # assign to bob, then bob sees it
    api.force_authenticate(user=alice)
    assign = api.post(
        f"/api/v1/todos/{todo_id}/assign/", {"assignee": bob.pk}, format="json"
    )
    assert assign.status_code == 200
    api.force_authenticate(user=bob)
    assert api.get("/api/v1/todos/").json()["count"] == 1


@pytest.mark.django_db
def test_assignment_to_inactive_user_rejected(api, seeded, make_user, todo_payload):
    alice = make_user("alice2", roles=("standard_user",))
    inactive = make_user("ghost", roles=(), is_active=False)
    api.force_authenticate(user=alice)
    todo_id = api.post("/api/v1/todos/", todo_payload, format="json").json()["id"]
    response = api.post(
        f"/api/v1/todos/{todo_id}/assign/", {"assignee": inactive.pk}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_invalid_status_transition_rejected(api, seeded, make_user, todo_payload):
    alice = make_user("alice3", roles=("standard_user",))
    api.force_authenticate(user=alice)
    todo_id = api.post("/api/v1/todos/", todo_payload, format="json").json()["id"]
    # open -> completed is not allowed directly
    response = api.post(
        f"/api/v1/todos/{todo_id}/status/", {"status": "completed"}, format="json"
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_valid_status_transition_succeeds(api, seeded, make_user, todo_payload):
    from audit.models import AuditLog

    alice = make_user("alice4", roles=("standard_user",))
    api.force_authenticate(user=alice)
    todo_id = api.post("/api/v1/todos/", todo_payload, format="json").json()["id"]
    before = AuditLog.objects.count()
    response = api.post(
        f"/api/v1/todos/{todo_id}/status/", {"status": "in_progress"}, format="json"
    )
    assert response.status_code == 200
    assert AuditLog.objects.count() == before + 1


@pytest.mark.django_db
def test_failed_mutation_creates_no_success_audit(api, seeded, make_user, todo_payload):
    from audit.models import AuditLog

    alice = make_user("alice5", roles=("standard_user",))
    api.force_authenticate(user=alice)
    todo_id = api.post("/api/v1/todos/", todo_payload, format="json").json()["id"]
    before = AuditLog.objects.count()
    response = api.post(
        f"/api/v1/todos/{todo_id}/status/", {"status": "completed"}, format="json"
    )
    assert response.status_code == 400
    assert AuditLog.objects.count() == before
