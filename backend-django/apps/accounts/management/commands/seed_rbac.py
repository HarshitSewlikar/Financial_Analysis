"""Seed system roles, registered permissions, and menus (idempotent)."""

from django.core.management.base import BaseCommand

from access_control.seed import seed_rbac


class Command(BaseCommand):
    help = "Create/refresh system roles, registered permissions, and menu definitions."

    def handle(self, *args, **options):
        result = seed_rbac()
        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {len(result['permissions'])} permissions, "
                f"{len(result['roles'])} roles, {len(result['menus'])} menus."
            )
        )
