from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from audit.models import AuditLog
from trackers.models import Tracker


@pytest.fixture
def payload():
    return {
        "symbol": "ibm",
        "status": "planned",
        "review_on": "2026-12-01",
        "follow_up_on": "2026-12-15",
        "summary": "Check the next earnings commentary.",
    }


@pytest.mark.django_db
def test_owner_crud_persists_and_audits(api, seeded, make_user, payload):
    alice = make_user("tr_alice", roles=("standard_user",))
    api.force_authenticate(user=alice)

    created = api.post("/api/v1/trackers/", payload, format="json")
    assert created.status_code == 201
    body = created.json()
    assert body["symbol"] == "IBM"
    assert body["company_name"] == "International Business Machines"
    item_id = body["id"]
    stored = Tracker.objects.get(pk=item_id)
    assert stored.analyst_id == alice.pk

    assert api.get("/api/v1/trackers/").json()["count"] == 1

    updated = api.patch(
        f"/api/v1/trackers/{item_id}/",
        {"status": "in_review", "summary": "Earnings commentary is in progress."},
        format="json",
    )
    assert updated.status_code == 200
    stored.refresh_from_db()
    assert stored.status == "in_review"

    assert api.delete(f"/api/v1/trackers/{item_id}/").status_code == 204
    stored.refresh_from_db()
    assert stored.deleted_at is not None
    assert api.get("/api/v1/trackers/").json()["count"] == 0

    actions = set(
        AuditLog.objects.filter(resource_type="Tracker", object_id=str(item_id)).values_list(
            "action", flat=True
        )
    )
    assert actions == {"tracker_created", "tracker_updated", "tracker_deleted"}


@pytest.mark.django_db
def test_follow_up_before_review_is_rejected(api, seeded, make_user, payload):
    alice = make_user("tr_dates", roles=("standard_user",))
    api.force_authenticate(user=alice)
    response = api.post(
        "/api/v1/trackers/",
        {**payload, "follow_up_on": "2026-11-01"},
        format="json",
    )
    assert response.status_code == 400
    assert Tracker.objects.count() == 0


@pytest.mark.django_db
def test_other_user_gets_404_and_unknown_symbol_is_400(api, seeded, make_user, payload):
    alice = make_user("tr_owner", roles=("standard_user",))
    bob = make_user("tr_other", roles=("standard_user",))
    api.force_authenticate(user=alice)
    item_id = api.post("/api/v1/trackers/", payload, format="json").json()["id"]

    api.force_authenticate(user=bob)
    assert api.get(f"/api/v1/trackers/{item_id}/").status_code == 404

    api.force_authenticate(user=alice)
    assert api.post("/api/v1/trackers/", {**payload, "symbol": "NFLX"}, format="json").status_code == 400


@pytest.mark.django_db
def test_missing_permission_is_403(api, seeded, make_user, payload):
    outsider = make_user("tr_none", roles=())
    api.force_authenticate(user=outsider)
    assert api.get("/api/v1/trackers/").status_code == 403
    assert api.post("/api/v1/trackers/", payload, format="json").status_code == 403


@pytest.mark.django_db
def test_summary_and_timing_use_owner_rows(api, seeded, make_user, payload):
    alice = make_user("tr_summary", roles=("standard_user",))
    bob = make_user("tr_summary_other", roles=("standard_user",))
    today = timezone.localdate()
    api.force_authenticate(user=alice)
    api.post("/api/v1/trackers/", {**payload, "review_on": str(today + timedelta(days=3))}, format="json")
    api.post(
        "/api/v1/trackers/",
        {**payload, "symbol": "AAPL", "status": "in_review", "review_on": str(today - timedelta(days=2))},
        format="json",
    )
    api.post(
        "/api/v1/trackers/",
        {**payload, "symbol": "MSFT", "status": "complete", "review_on": str(today - timedelta(days=9))},
        format="json",
    )
    removed = api.post(
        "/api/v1/trackers/",
        {**payload, "symbol": "TSLA", "review_on": str(today - timedelta(days=1))},
        format="json",
    ).json()["id"]
    api.delete(f"/api/v1/trackers/{removed}/")
    api.force_authenticate(user=bob)
    api.post("/api/v1/trackers/", payload, format="json")

    api.force_authenticate(user=alice)
    body = api.get("/api/v1/trackers/summary/").json()
    assert body == {
        "total": 3,
        "planned": 1,
        "in_review": 1,
        "complete": 1,
        "upcoming": 1,
        "overdue": 1,
    }
    assert api.get("/api/v1/trackers/", {"timing": "overdue"}).json()["count"] == 1
    assert api.get("/api/v1/trackers/", {"timing": "upcoming"}).json()["count"] == 1
    assert api.get("/api/v1/trackers/", {"timing": "complete"}).json()["count"] == 1
