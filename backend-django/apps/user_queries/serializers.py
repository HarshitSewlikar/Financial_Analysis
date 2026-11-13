from __future__ import annotations

from rest_framework import serializers

from .models import UserQuery


class UserQuerySerializer(serializers.ModelSerializer):
    class Meta:
        model = UserQuery
        fields = ["id", "subject", "category", "description", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_subject(self, value):
        text = str(value or "").strip()
        if not text:
            raise serializers.ValidationError("Enter a subject.")
        return text

    def validate_description(self, value):
        text = str(value or "").strip()
        if not text:
            raise serializers.ValidationError("Enter a description.")
        return text
