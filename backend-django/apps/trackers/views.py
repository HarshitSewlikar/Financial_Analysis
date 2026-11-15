from __future__ import annotations

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from access_control.permissions import HasPermission
from audit.services import record_audit

from .models import Tracker
from .serializers import TrackerSerializer


class TrackerViewSet(viewsets.ModelViewSet):
    serializer_class = TrackerSerializer
    search_fields = ["summary", "symbol"]
    ordering_fields = ["review_on", "created_at", "symbol", "status"]
    filterset_fields = ["symbol", "status"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in {"list", "retrieve", "summary"}:
            return [HasPermission("trackers.read")()]
        if self.action == "create":
            return [HasPermission("trackers.create")()]
        if self.action == "partial_update":
            return [HasPermission("trackers.update")()]
        if self.action == "destroy":
            return [HasPermission("trackers.delete")()]
        return [HasPermission("trackers.read")()]

    def _owned(self):
        user = self.request.user
        qs = Tracker.objects.filter(deleted_at__isnull=True).select_related("analyst")
        if getattr(user, "is_protected_admin", False):
            return qs
        return qs.filter(analyst=user)

    def get_queryset(self):
        qs = self._owned()
        if getattr(self, "action", None) == "summary":
            return qs
        today = timezone.localdate()
        timing = self.request.query_params.get("timing")
        if timing == "upcoming":
            return qs.exclude(status=Tracker.Status.COMPLETE).filter(review_on__gte=today)
        if timing == "overdue":
            return qs.exclude(status=Tracker.Status.COMPLETE).filter(review_on__lt=today)
        if timing == "complete":
            return qs.filter(status=Tracker.Status.COMPLETE)
        return qs

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self._owned()
        today = timezone.localdate()
        open_reviews = qs.exclude(status=Tracker.Status.COMPLETE)
        counted = {row["status"]: row["total"] for row in qs.values("status").annotate(total=Count("id"))}
        return Response(
            {
                "total": qs.count(),
                "planned": counted.get(Tracker.Status.PLANNED, 0),
                "in_review": counted.get(Tracker.Status.IN_REVIEW, 0),
                "complete": counted.get(Tracker.Status.COMPLETE, 0),
                "upcoming": open_reviews.filter(review_on__gte=today).count(),
                "overdue": open_reviews.filter(review_on__lt=today).count(),
            }
        )

    def perform_create(self, serializer):
        item = serializer.save(analyst=self.request.user)
        record_audit(
            actor=self.request.user,
            action="tracker_created",
            resource_type="Tracker",
            object_id=item.pk,
            after={"symbol": item.symbol, "status": item.status, "review_on": str(item.review_on)},
        )

    def perform_update(self, serializer):
        before = {
            "status": serializer.instance.status,
            "symbol": serializer.instance.symbol,
            "review_on": str(serializer.instance.review_on),
        }
        item = serializer.save()
        record_audit(
            actor=self.request.user,
            action="tracker_updated",
            resource_type="Tracker",
            object_id=item.pk,
            before=before,
            after={"symbol": item.symbol, "status": item.status, "review_on": str(item.review_on)},
        )

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        item.deleted_at = timezone.now()
        item.save(update_fields=["deleted_at", "updated_at"])
        record_audit(
            actor=request.user,
            action="tracker_deleted",
            resource_type="Tracker",
            object_id=item.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
