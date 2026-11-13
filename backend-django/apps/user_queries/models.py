from __future__ import annotations

from django.conf import settings
from django.db import models


class UserQuery(models.Model):
    class Category(models.TextChoices):
        TECHNICAL = "technical", "Technical Issue"
        DATA = "data", "Data / Analytics"
        ACCOUNT = "account", "Account / Access"
        GENERAL = "general", "General Question"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="queries",
    )
    subject = models.CharField(max_length=200)
    category = models.CharField(max_length=20, choices=Category.choices)
    description = models.TextField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN
    )
    admin_response = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.subject
