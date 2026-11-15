from __future__ import annotations

from django.conf import settings
from django.db import models
from django.utils import timezone


SUPPORTED_SYMBOLS = ("IBM", "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA")


class WatchlistItem(models.Model):
    class Stance(models.TextChoices):
        POSITIVE = "positive", "Positive"
        NEUTRAL = "neutral", "Neutral"
        NEGATIVE = "negative", "Negative"

    symbol = models.CharField(max_length=10)
    title = models.CharField(max_length=200)
    thesis = models.TextField()
    stance = models.CharField(max_length=20, choices=Stance.choices)
    note_date = models.DateField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="watchlist_items",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-note_date", "-created_at"]
        indexes = [
            models.Index(fields=["author", "symbol", "note_date"], name="watchlist_author_symbol_date"),
            models.Index(fields=["deleted_at"], name="watchlist_deleted_at"),
        ]

    def __str__(self):
        return self.title
