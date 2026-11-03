from __future__ import annotations

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin,
)
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils import timezone

from common.utils import normalize_email, normalize_username


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, username, password, **extra_fields):
        if not username:
            raise ValueError("The username must be set.")
        username = normalize_username(username)
        email = normalize_email(extra_fields.get("email"))
        extra_fields["email"] = email or None
        user = self.model(username=username, **extra_fields)
        user.set_password(password)
        user.full_clean(exclude=None, validate_unique=False)
        user.save(using=self._db)
        return user

    def create_user(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, password, **extra_fields)

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(username, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Application user.

    ``is_staff`` / ``is_superuser`` only gate the Django admin site. They are
    *not* the application authorization mechanism; application permissions are
    resolved from roles/permissions in :mod:`access_control`.
    """

    name = models.CharField(max_length=150, blank=True)
    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[MinLengthValidator(3)],
        help_text="Normalized to lowercase; must be unique.",
    )
    email = models.EmailField(null=True, blank=True, unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_protected_admin = models.BooleanField(
        default=False,
        help_text="Protected bootstrap administrator; cannot be deleted or stripped.",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "username"
    REQUIRED_FIELDS = []

    class Meta:
        ordering = ["username"]
        indexes = [
            models.Index(fields=["is_active"]),
            models.Index(fields=["deleted_at"]),
        ]

    def save(self, *args, **kwargs):
        self.username = normalize_username(self.username)
        self.email = normalize_email(self.email) or None
        super().save(*args, **kwargs)

    def delete(self, using=None, keep_parents=False):
        # Soft delete: never physically remove a user row.
        self.deleted_at = timezone.now()
        self.is_active = False
        self.save(update_fields=["deleted_at", "is_active", "updated_at"])

    def __str__(self):
        return self.username


class SetupState(models.Model):
    """Singleton row (pk=1) tracking one-time bootstrap state."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    is_bootstrapped = models.BooleanField(default=False)
    bootstrap_admin = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Setup state"
        verbose_name_plural = "Setup state"

    def __str__(self):
        return f"SetupState(bootstrapped={self.is_bootstrapped})"

    def save(self, *args, **kwargs):
        self.id = 1
        super().save(*args, **kwargs)


class LoginAttempt(models.Model):
    """Audit-friendly record of login attempts for lockout/throttle logic."""

    username = models.CharField(max_length=150, db_index=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    successful = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
