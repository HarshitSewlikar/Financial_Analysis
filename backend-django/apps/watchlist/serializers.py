from __future__ import annotations

from rest_framework import serializers

from .models import SUPPORTED_SYMBOLS, WatchlistItem

COMPANY_NAMES = {
    "IBM": "International Business Machines",
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com, Inc.",
    "TSLA": "Tesla, Inc.",
}


class WatchlistItemSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = WatchlistItem
        fields = [
            "id",
            "symbol",
            "company_name",
            "title",
            "thesis",
            "stance",
            "note_date",
            "author",
            "author_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = [
            "id",
            "company_name",
            "author",
            "author_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]

    def get_company_name(self, obj):
        return COMPANY_NAMES.get(obj.symbol, obj.symbol)

    def validate_symbol(self, value):
        symbol = str(value or "").strip().upper()
        if symbol not in SUPPORTED_SYMBOLS:
            raise serializers.ValidationError("Choose one of the six supported companies.")
        return symbol

    def validate_title(self, value):
        title = str(value or "").strip()
        if not title:
            raise serializers.ValidationError("Title is required.")
        return title

    def validate_thesis(self, value):
        thesis = str(value or "").strip()
        if not thesis:
            raise serializers.ValidationError("Thesis is required.")
        return thesis
