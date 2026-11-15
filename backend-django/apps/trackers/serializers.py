from __future__ import annotations

from rest_framework import serializers

from .models import SUPPORTED_SYMBOLS, Tracker

COMPANY_NAMES = {
    "IBM": "International Business Machines",
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com, Inc.",
    "TSLA": "Tesla, Inc.",
}


class TrackerSerializer(serializers.ModelSerializer):
    analyst_username = serializers.CharField(source="analyst.username", read_only=True)
    company_name = serializers.SerializerMethodField()

    class Meta:
        model = Tracker
        fields = [
            "id",
            "symbol",
            "company_name",
            "status",
            "review_on",
            "follow_up_on",
            "summary",
            "analyst",
            "analyst_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = [
            "id",
            "company_name",
            "analyst",
            "analyst_username",
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

    def validate_summary(self, value):
        summary = str(value or "").strip()
        if not summary:
            raise serializers.ValidationError("Summary is required.")
        return summary

    def validate(self, attrs):
        review_on = attrs.get("review_on", getattr(self.instance, "review_on", None))
        if "follow_up_on" in attrs:
            follow_up_on = attrs.get("follow_up_on")
        else:
            follow_up_on = getattr(self.instance, "follow_up_on", None)
        if follow_up_on and review_on and follow_up_on < review_on:
            raise serializers.ValidationError(
                {"follow_up_on": "Follow-up date must be on or after the review date."}
            )
        return attrs
