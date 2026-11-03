"""Import legacy JSON users into MySQL.

Dry-run by default. Preserves bcrypt hashes only when Django can verify them.

Usage:
    python manage.py import_legacy_users --path backend/data/users.json
    python manage.py import_legacy_users --path backend/data/users.json --apply
"""

from __future__ import annotations

import json
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from access_control.models import Role, UserRole
from access_control.seed import seed_rbac
from accounts.models import SetupState

User = get_user_model()

# bcrypt hashes are prefixed so the BCryptPasswordHasher can verify them.
BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")


def django_bcrypt_hash(legacy_hash: str) -> str:
    """Return a Django-verifiable hash for a legacy bcrypt hash.

    Django's ``BCryptPasswordHasher`` expects ``bcrypt$`` in front of the raw
    bcrypt string (``bcrypt$$2b$...``). Legacy ``bcryptjs`` hashes are raw
    ``$2b$...``.
    """
    if legacy_hash.startswith(BCRYPT_PREFIXES):
        return "bcrypt$" + legacy_hash
    return legacy_hash


class Command(BaseCommand):
    help = "Dry-run-first import of legacy JSON users (bcrypt hashes)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default="backend/data/users.json",
            help="Path to the legacy users.json file.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually write users (default is dry-run).",
        )

    def handle(self, *args, **options):
        path = Path(options["path"])
        if not path.exists():
            raise CommandError(f"Legacy users file not found: {path}")

        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            raise CommandError(f"Invalid JSON in {path}: {exc}") from exc
        if not isinstance(raw, list):
            raise CommandError("Expected a JSON array of users.")

        apply = options["apply"]
        self.stdout.write(
            f"{'APPLYING' if apply else 'DRY-RUN'}: {len(raw)} legacy user record(s) in {path}"
        )

        seed_rbac()

        imports = []
        conflicts = []
        for record in raw:
            username = str(record.get("username", "")).strip().lower()
            if not username:
                conflicts.append("<blank username>")
                continue
            if User.objects.filter(username=username).exists():
                conflicts.append(username)
                continue
            pw_hash = record.get("passwordHash", "")
            if not isinstance(pw_hash, str) or not (
                pw_hash.startswith(BCRYPT_PREFIXES) or pw_hash.startswith("bcrypt$")
            ):
                conflicts.append(f"{username} (unsupported hash)")
                continue
            imports.append(record)

        self.stdout.write(f"  importable: {len(imports)}")
        self.stdout.write(f"  conflicts/skipped: {len(conflicts)}")
        for name in conflicts:
            self.stdout.write(f"    - skipped {name}")

        verifiable = []
        for record in imports:
            if self._hash_verifiable(record["passwordHash"]):
                verifiable.append(record)
            else:
                self.stdout.write(
                    f"    ! {record['username']}: hash not verifiable; would require reset"
                )

        if not apply:
            self.stdout.write(
                self.style.WARNING("Dry-run complete. Re-run with --apply to write.")
            )
            return

        created = 0
        admin_imported = False
        with transaction.atomic():
            state = SetupState.objects.select_for_update().get(pk=1)
            for record in verifiable:
                username = str(record["username"]).strip().lower()
                created_at = parse_datetime(record.get("createdAt", "")) or timezone.now()
                user = User(
                    username=username,
                    email=(record.get("email") or "").strip().lower() or None,
                    name=record.get("name", ""),
                    is_active=True,
                )
                user.password = django_bcrypt_hash(record["passwordHash"])
                user.created_at = created_at
                if record.get("role") == "admin" and not state.is_bootstrapped:
                    user.is_protected_admin = True
                    user.is_staff = True
                    user.is_superuser = True
                    admin_imported = True
                user.save()

                role_code = "administrator" if record.get("role") == "admin" else "standard_user"
                role = Role.objects.filter(code=role_code).first()
                if role is not None:
                    UserRole.objects.get_or_create(user=user, role=role)
                created += 1

            if admin_imported:
                protected = User.objects.filter(is_protected_admin=True).first()
                state.is_bootstrapped = True
                state.bootstrap_admin = protected
                state.completed_at = timezone.now()
                state.save(
                    update_fields=[
                        "is_bootstrapped",
                        "bootstrap_admin",
                        "completed_at",
                        "updated_at",
                    ]
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {created} user(s). Bootstrap complete: {admin_imported}"
            )
        )

    @staticmethod
    def _hash_verifiable(password_hash: str) -> bool:
        """Verify Django can verify a controlled bcrypt hash round-trip."""
        from django.contrib.auth.hashers import check_password, make_password

        probe = make_password("probe", hasher="bcrypt")
        if not check_password("probe", probe):
            return False
        return password_hash.startswith(BCRYPT_PREFIXES) or password_hash.startswith(
            "bcrypt$"
        )
