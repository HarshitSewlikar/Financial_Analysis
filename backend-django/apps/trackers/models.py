from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


SUPPORTED_SYMBOLS = ("IBM", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA")


class Tracker(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        IN_REVIEW = "in_review", "In review"
        COMPLETE = "complete", "Complete"

    symbol = models.CharField(max_length=10)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNED)
    review_on = models.DateField()
    follow_up_on = models.DateField(null=True, blank=True)
    summary = models.TextField()
    analyst = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="trackers",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["review_on", "-created_at"]
        indexes = [
            models.Index(fields=["analyst", "status", "review_on"], name="trackers_analyst_status_date"),
            models.Index(fields=["deleted_at"], name="trackers_deleted_at"),
        ]

    def __str__(self):
        return f"{self.symbol} {self.review_on}"
