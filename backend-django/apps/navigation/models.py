from __future__ import annotations

from django.db import models
from django.utils import timezone

from access_control.models import Role


class Menu(models.Model):
    code = models.CharField(max_length=100, unique=True)
    label = models.CharField(max_length=150)
    path = models.CharField(max_length=255)
    component_key = models.CharField(
        max_length=100,
        help_text="Key into the frontend's allowlisted component registry.",
    )
    required_permission = models.CharField(
        max_length=150,
        blank=True,
        help_text=(
            "Registered permission code required to see/authorize this page. "
            "Empty means only role-menu mapping is required."
        ),
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="children",
    )
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "label"]
        indexes = [models.Index(fields=["is_active", "sort_order"])]

    def __str__(self):
        return self.code


class RoleMenu(models.Model):
    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name="role_menus"
    )
    menu = models.ForeignKey(
        Menu, on_delete=models.CASCADE, related_name="role_menus"
    )
    granted_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["role", "menu"], name="uq_role_menu"
            )
        ]

    def __str__(self):
        return f"{self.role.code} -> {self.menu.code}"


class UserMenuOverride(models.Model):
    """Stored per-user menu exceptions. Navigation does not read this table.

    RoleMenu is the source of page visibility. Rows stay until a reviewed
    migration drops the table.
    """

    class Effect(models.TextChoices):
        SHOW = "SHOW", "Show"
        HIDE = "HIDE", "Hide"

    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="menu_overrides",
    )
    menu = models.ForeignKey(
        Menu, on_delete=models.CASCADE, related_name="user_overrides"
    )
    effect = models.CharField(max_length=4, choices=Effect.choices)
    granted_by = models.ForeignKey(
        "accounts.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "menu"], name="uq_user_menu_override"
            )
        ]

    def __str__(self):
        return f"{self.user_id} {self.effect} {self.menu.code}"
