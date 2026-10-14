from __future__ import annotations

import json

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from accounts.models import SetupState

User = get_user_model()


def _raw_bcrypt_hash(password):
    import bcrypt

    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def _legacy_record(username, role="user"):
    return {
        "username": username,
        "passwordHash": _raw_bcrypt_hash("LegacyPass!23"),
        "role": role,
        "createdAt": "2026-01-01T10:00:00.000Z",
    }


@pytest.mark.django_db
def test_dry_run_does_not_create_users(tmp_path, seeded, capsys):
    path = tmp_path / "users.json"
    path.write_text(json.dumps([_legacy_record("legacyuser")]), encoding="utf-8")
    call_command("import_legacy_users", path=str(path))
    assert not User.objects.filter(username="legacyuser").exists()
    out = capsys.readouterr().out
    assert "DRY-RUN" in out


@pytest.mark.django_db
def test_apply_imports_user_and_preserves_hash(tmp_path, seeded):
    path = tmp_path / "users.json"
    path.write_text(json.dumps([_legacy_record("legacyuser")]), encoding="utf-8")
    call_command("import_legacy_users", path=str(path), apply=True)
    user = User.objects.get(username="legacyuser")
    assert user.check_password("LegacyPass!23")


@pytest.mark.django_db
def test_apply_is_idempotent_and_marks_bootstrap(tmp_path, seeded):
    path = tmp_path / "users.json"
    path.write_text(json.dumps([_legacy_record("legacyadmin", role="admin")]), encoding="utf-8")
    call_command("import_legacy_users", path=str(path), apply=True)
    call_command("import_legacy_users", path=str(path), apply=True)
    assert User.objects.filter(username="legacyadmin").count() == 1
    admin = User.objects.get(username="legacyadmin")
    assert admin.is_protected_admin is True
    assert SetupState.objects.get(pk=1).is_bootstrapped is True


@pytest.mark.django_db
def test_unsupported_hash_is_skipped(tmp_path, seeded):
    record = _legacy_record("plaintextuser")
    record["passwordHash"] = "not-a-bcrypt-hash"
    path = tmp_path / "users.json"
    path.write_text(json.dumps([record]), encoding="utf-8")
    call_command("import_legacy_users", path=str(path), apply=True)
    assert not User.objects.filter(username="plaintextuser").exists()
