from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from access_control import policy
from access_control.permissions import CanAccessTodo, HasPermission
from audit.services import record_audit

from .models import Todo
from .serializers import (
    ALLOWED_TRANSITIONS,
    TodoAssignSerializer,
    TodoSerializer,
    TodoStatusSerializer,
)

User = get_user_model()


class TodoViewSet(viewsets.ModelViewSet):
    serializer_class = TodoSerializer
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "due_at", "priority", "status"]
    filterset_fields = ["status", "priority", "assignee", "owner"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [HasPermission("todos.read")()]
        if self.action == "create":
            return [HasPermission("todos.create")()]
        if self.action == "destroy":
            return [HasPermission("todos.delete")(), CanAccessTodo()]
        if self.action in {"assign", "status"}:
            perms = [HasPermission("todos.update")()]
            if self.action == "assign":
                perms = [HasPermission("todos.assign")()]
            return perms
        if self.action in {"update", "partial_update"}:
            return [HasPermission("todos.update")(), CanAccessTodo()]
        return [HasPermission("todos.read")()]

    def get_queryset(self):
        user = self.request.user
        qs = Todo.objects.filter(deleted_at__isnull=True).select_related(
            "owner", "assignee"
        )
        if user.is_protected_admin or policy.has_permission(user, "todos.manage"):
            return qs
        return qs.filter(Q(owner=user) | Q(assignee=user))

    def perform_create(self, serializer):
        todo = serializer.save(owner=self.request.user, created_by=self.request.user)
        record_audit(
            actor=self.request.user,
            action="todo_created",
            resource_type="Todo",
            object_id=todo.pk,
            after={"title": todo.title, "status": todo.status},
        )

    def perform_update(self, serializer):
        before = {
            "status": serializer.instance.status,
            "assignee": serializer.instance.assignee_id,
        }
        todo = serializer.save(updated_by=self.request.user)
        record_audit(
            actor=self.request.user,
            action="todo_updated",
            resource_type="Todo",
            object_id=todo.pk,
            before=before,
            after={"status": todo.status, "assignee": todo.assignee_id},
        )

    def destroy(self, request, *args, **kwargs):
        todo = self.get_object()
        todo.deleted_at = timezone.now()
        todo.save(update_fields=["deleted_at", "updated_at"])
        record_audit(
            actor=request.user,
            action="todo_deleted",
            resource_type="Todo",
            object_id=todo.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def assign(self, request, pk=None):
        todo = self.get_object()
        serializer = TodoAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignee_id = serializer.validated_data.get("assignee")

        if not policy.has_permission(request.user, "todos.assign"):
            if todo.owner_id != request.user.pk:
                return Response(
                    {"error": {"detail": "Only the owner or a delegate can assign this to-do."}},
                    status=status.HTTP_403_FORBIDDEN,
                )

        assignee = None
        if assignee_id is not None:
            assignee = User.objects.filter(
                pk=assignee_id, is_active=True, deleted_at__isnull=True
            ).first()
            if assignee is None:
                return Response(
                    {"error": {"detail": "Assignee must be an active user."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        todo.assignee = assignee
        todo.updated_by = request.user
        todo.save(update_fields=["assignee", "updated_by", "updated_at"])
        record_audit(
            actor=request.user,
            action="todo_assigned",
            resource_type="Todo",
            object_id=todo.pk,
            after={"assignee": assignee_id},
        )
        return Response(TodoSerializer(todo).data)

    @action(detail=True, methods=["post"], url_path="status")
    def status(self, request, pk=None):
        todo = self.get_object()
        serializer = TodoStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        if new_status != todo.status:
            allowed = ALLOWED_TRANSITIONS.get(todo.status, set())
            if new_status not in allowed:
                return Response(
                    {"error": {"detail": f"Invalid transition from '{todo.status}' to '{new_status}'."}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        before = todo.status
        todo.status = new_status
        todo.updated_by = request.user
        todo.save(update_fields=["status", "updated_by", "updated_at"])
        record_audit(
            actor=request.user,
            action="todo_status_changed",
            resource_type="Todo",
            object_id=todo.pk,
            before={"status": before},
            after={"status": new_status},
        )
        return Response(TodoSerializer(todo).data)
