"""Bootstrap and login-related domain services."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.utils import timezone

from access_control.models import Role, UserRole
from access_control.seed import seed_rbac

from .models import LoginAttempt, SetupState

User = get_user_model()


class AlreadyBootstrapped(Exception):
    """Raised when bootstrap is attempted after setup is complete."""


class SignupNotConfigured(Exception):
    """Raised when ADMIN_SIGNUP_CODE is not configured."""


@transaction.atomic
def bootstrap_admin(*, username, password, name="", email=""):
    """Atomically create the single protected bootstrap administrator.

    Uses ``select_for_update`` on the singleton setup row so concurrent
    requests cannot both succeed.
    """
    state = SetupState.objects.select_for_update().get(pk=1)
    if state.is_bootstrapped:
        raise AlreadyBootstrapped()
    if not getattr(settings, "ADMIN_SIGNUP_CODE", ""):
        raise SignupNotConfigured()

    seed_rbac()

    try:
        user = User.objects.create_user(
            username=username, password=password, name=name, email=email
        )
    except IntegrityError as exc:
        raise AlreadyBootstrapped() from exc

    user.is_protected_admin = True
    user.is_staff = True
    user.is_superuser = True
    user.save(update_fields=["is_protected_admin", "is_staff", "is_superuser"])

    admin_role = Role.objects.filter(code="administrator").first()
    if admin_role is not None:
        UserRole.objects.get_or_create(
            user=user, role=admin_role, defaults={"assigned_by": user}
        )

    state.is_bootstrapped = True
    state.bootstrap_admin = user
    state.completed_at = timezone.now()
    state.save(update_fields=["is_bootstrapped", "bootstrap_admin", "completed_at", "updated_at"])
    return user


def record_login_attempt(username, ip_address, successful):
    return LoginAttempt.objects.create(
        username=str(username or "")[:150],
        ip_address=ip_address or None,
        successful=successful,
    )


def is_locked_out(username, ip_address, *, window_minutes=15, threshold=5):
    since = timezone.now() - timezone.timedelta(minutes=window_minutes)
    failures = LoginAttempt.objects.filter(
        username=str(username or "")[:150],
        ip_address=ip_address or None,
        successful=False,
        created_at__gte=since,
    ).count()
    return failures >= threshold
