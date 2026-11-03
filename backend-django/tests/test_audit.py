from __future__ import annotations

import pytest
from django.contrib.auth import get_user_model
from django.db import transaction

from audit.models import AuditLog
from audit.services import record_audit

User = get_user_model()


@pytest.mark.django_db
def test_audit_records_before_after_and_actor(seeded, make_user):
    actor = make_user("auditor_actor", roles=("standard_user",))
    log = record_audit(
        actor=actor,
        action="todo_updated",
        resource_type="Todo",
        object_id="42",
        before={"status": "open"},
        after={"status": "completed"},
    )
    assert log.actor_id == actor.pk
    assert log.correlation_id == ""
    assert log.before == {"status": "open"}
    assert log.after == {"status": "completed"}


@pytest.mark.django_db
def test_audit_redacts_sensitive_fields(seeded, make_user):
    actor = make_user("auditor_actor2", roles=("standard_user",))
    log = record_audit(
        actor=actor,
        action="user_created",
        resource_type="User",
        object_id="7",
        after={"username": "x", "password": "hunter2", "refresh_token": "abc"},
    )
    assert log.after["password"] == "[redacted]"
    assert log.after["refresh_token"] == "[redacted]"


@pytest.mark.django_db
def test_audit_logs_are_read_only_through_api(api, seeded, admin_user):
    record_audit(
        actor=admin_user, action="x", resource_type="Y", object_id="1"
    )
    api.force_authenticate(user=admin_user)
    log = AuditLog.objects.first()
    assert api.get("/api/v1/audit-logs/").status_code == 200
    assert api.get(f"/api/v1/audit-logs/{log.pk}/").status_code == 200
    assert api.patch(f"/api/v1/audit-logs/{log.pk}/", {"action": "z"}).status_code == 405
    assert api.delete(f"/api/v1/audit-logs/{log.pk}/").status_code == 405


@pytest.mark.django_db
def test_audit_rolls_back_with_failed_transaction(seeded, make_user):
    actor = make_user("rollback_user", roles=("standard_user",))
    before_count = AuditLog.objects.count()

    class Boom(Exception):
        pass

    with pytest.raises(Boom):
        with transaction.atomic():
            record_audit(
                actor=actor, action="y", resource_type="Z", object_id="1"
            )
            raise Boom()

    assert AuditLog.objects.count() == before_count


@pytest.mark.django_db
def test_audit_export_requires_export_permission(api, seeded, make_user):
    reader = make_user("audit_reader", roles=("standard_user",))
    api.force_authenticate(user=reader)
    assert api.get("/api/v1/audit-logs/export/").status_code == 403

    auditor = make_user("auditor_user", roles=("auditor",))
    api.force_authenticate(user=auditor)
    response = api.get("/api/v1/audit-logs/export/")
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
