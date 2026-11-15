from __future__ import annotations

import pytest

from audit.models import AuditLog
from watchlist.models import WatchlistItem


@pytest.fixture
def payload():
    return {
        "symbol": "aapl",
        "title": "Services mix",
        "thesis": "Services revenue is becoming a larger share of the business.",
        "stance": "positive",
        "note_date": "2026-11-01",
    }


@pytest.mark.django_db
def test_owner_crud_persists_and_audits(api, seeded, make_user, payload):
    alice = make_user("wl_alice", roles=("standard_user",))
    api.force_authenticate(user=alice)

    created = api.post("/api/v1/watchlist/", payload, format="json")
    assert created.status_code == 201
    body = created.json()
    assert body["symbol"] == "AAPL"
    assert body["company_name"] == "Apple Inc."
    item_id = body["id"]
    stored = WatchlistItem.objects.get(pk=item_id)
    assert stored.author_id == alice.pk
    assert stored.thesis.startswith("Services")

    listed = api.get("/api/v1/watchlist/").json()
    assert listed["count"] == 1
    assert listed["results"][0]["id"] == item_id

    updated = api.patch(
        f"/api/v1/watchlist/{item_id}/",
        {"stance": "neutral", "title": "Services mix revised"},
        format="json",
    )
    assert updated.status_code == 200
    stored.refresh_from_db()
    assert stored.stance == "neutral"
    assert stored.title == "Services mix revised"

    deleted = api.delete(f"/api/v1/watchlist/{item_id}/")
    assert deleted.status_code == 204
    stored.refresh_from_db()
    assert stored.deleted_at is not None
    assert api.get("/api/v1/watchlist/").json()["count"] == 0

    actions = set(
        AuditLog.objects.filter(resource_type="WatchlistItem", object_id=str(item_id)).values_list(
            "action", flat=True
        )
    )
    assert actions == {"watchlist_created", "watchlist_updated", "watchlist_deleted"}


@pytest.mark.django_db
def test_other_user_cannot_see_or_edit(api, seeded, make_user, payload):
    alice = make_user("wl_owner", roles=("standard_user",))
    bob = make_user("wl_other", roles=("standard_user",))
    api.force_authenticate(user=alice)
    item_id = api.post("/api/v1/watchlist/", payload, format="json").json()["id"]

    api.force_authenticate(user=bob)
    assert api.get("/api/v1/watchlist/").json()["count"] == 0
    assert api.get(f"/api/v1/watchlist/{item_id}/").status_code == 404
    assert api.patch(f"/api/v1/watchlist/{item_id}/", {"title": "Stolen"}, format="json").status_code == 404


@pytest.mark.django_db
def test_unknown_symbol_and_missing_permission(api, seeded, make_user, payload):
    alice = make_user("wl_writer", roles=("standard_user",))
    api.force_authenticate(user=alice)
    rejected = api.post("/api/v1/watchlist/", {**payload, "symbol": "NFLX"}, format="json")
    assert rejected.status_code == 400
    assert WatchlistItem.objects.count() == 0

    outsider = make_user("wl_none", roles=())
    api.force_authenticate(user=outsider)
    assert api.get("/api/v1/watchlist/").status_code == 403
    assert api.post("/api/v1/watchlist/", payload, format="json").status_code == 403


@pytest.mark.django_db
def test_protected_admin_sees_every_row(api, seeded, make_user, admin_user, payload):
    alice = make_user("wl_member", roles=("standard_user",))
    api.force_authenticate(user=alice)
    api.post("/api/v1/watchlist/", payload, format="json")

    api.force_authenticate(user=admin_user)
    assert api.get("/api/v1/watchlist/").json()["count"] == 1


@pytest.mark.django_db
def test_summary_counts_owner_rows_and_skips_deleted(api, seeded, make_user, payload):
    alice = make_user("wl_summary", roles=("standard_user",))
    bob = make_user("wl_summary_other", roles=("standard_user",))
    api.force_authenticate(user=alice)
    api.post("/api/v1/watchlist/", payload, format="json")
    api.post(
        "/api/v1/watchlist/",
        {**payload, "symbol": "MSFT", "stance": "negative", "title": "Cloud spend"},
        format="json",
    )
    removed = api.post(
        "/api/v1/watchlist/",
        {**payload, "symbol": "IBM", "stance": "neutral", "title": "Gone"},
        format="json",
    ).json()["id"]
    api.delete(f"/api/v1/watchlist/{removed}/")
    api.force_authenticate(user=bob)
    api.post("/api/v1/watchlist/", {**payload, "title": "Bob note"}, format="json")

    api.force_authenticate(user=alice)
    body = api.get("/api/v1/watchlist/summary/").json()
    assert body["companies"] == 2
    assert body["notes"] == 2
    assert body["stances"] == {"positive": 1, "neutral": 0, "negative": 1}
    assert len(body["recent"]) == 2
    assert {row["title"] for row in body["recent"]} == {"Services mix", "Cloud spend"}
