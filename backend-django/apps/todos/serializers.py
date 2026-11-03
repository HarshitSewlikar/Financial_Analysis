from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Todo

User = get_user_model()

ALLOWED_TRANSITIONS = {
    Todo.Status.OPEN: {Todo.Status.IN_PROGRESS, Todo.Status.CANCELLED},
    Todo.Status.IN_PROGRESS: {
        Todo.Status.OPEN,
        Todo.Status.BLOCKED,
        Todo.Status.COMPLETED,
        Todo.Status.CANCELLED,
    },
    Todo.Status.BLOCKED: {Todo.Status.IN_PROGRESS, Todo.Status.CANCELLED},
    Todo.Status.COMPLETED: {Todo.Status.OPEN},
    Todo.Status.CANCELLED: {Todo.Status.OPEN},
}


class TodoSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="owner.username", read_only=True)
    assignee_username = serializers.CharField(
        source="assignee.username", read_only=True
    )

    class Meta:
        model = Todo
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "due_at",
            "owner",
            "owner_username",
            "assignee",
            "assignee_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = [
            "id",
            "owner",
            "owner_username",
            "assignee_username",
            "created_at",
            "updated_at",
            "deleted_at",
        ]

    def validate_assignee(self, value):
        if value is not None and (not value.is_active or value.deleted_at is not None):
            raise serializers.ValidationError(
                "Cannot assign to an inactive or deleted user."
            )
        return value

    def validate_status(self, value):
        if self.instance is not None and value != self.instance.status:
            allowed = ALLOWED_TRANSITIONS.get(self.instance.status, set())
            if value not in allowed:
                raise serializers.ValidationError(
                    f"Invalid status transition from '{self.instance.status}' to '{value}'."
                )
        return value


class TodoStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Todo.Status.choices)


class TodoAssignSerializer(serializers.Serializer):
    assignee = serializers.IntegerField(allow_null=True, required=False)
