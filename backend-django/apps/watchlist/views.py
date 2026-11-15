from __future__ import annotations

from django.db.models import Count
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from access_control.permissions import HasPermission
from audit.services import record_audit

from .models import WatchlistItem
from .serializers import WatchlistItemSerializer


class WatchlistItemViewSet(viewsets.ModelViewSet):
    serializer_class = WatchlistItemSerializer
    search_fields = ["title", "thesis", "symbol"]
    ordering_fields = ["note_date", "created_at", "symbol", "stance"]
    filterset_fields = ["symbol", "stance"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in {"list", "retrieve", "summary"}:
            return [HasPermission("watchlist.read")()]
        if self.action == "create":
            return [HasPermission("watchlist.create")()]
        if self.action == "partial_update":
            return [HasPermission("watchlist.update")()]
        if self.action == "destroy":
            return [HasPermission("watchlist.delete")()]
        return [HasPermission("watchlist.read")()]

    def get_queryset(self):
        user = self.request.user
        qs = WatchlistItem.objects.filter(deleted_at__isnull=True).select_related("author")
        if getattr(user, "is_protected_admin", False):
            return qs
        return qs.filter(author=user)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        qs = self.get_queryset()
        counted = {row["stance"]: row["total"] for row in qs.values("stance").annotate(total=Count("id"))}
        return Response(
            {
                "companies": qs.values("symbol").distinct().count(),
                "notes": qs.count(),
                "stances": {
                    "positive": counted.get(WatchlistItem.Stance.POSITIVE, 0),
                    "neutral": counted.get(WatchlistItem.Stance.NEUTRAL, 0),
                    "negative": counted.get(WatchlistItem.Stance.NEGATIVE, 0),
                },
                "recent": self.get_serializer(qs[:3], many=True).data,
            }
        )

    def perform_create(self, serializer):
        item = serializer.save(author=self.request.user)
        record_audit(
            actor=self.request.user,
            action="watchlist_created",
            resource_type="WatchlistItem",
            object_id=item.pk,
            after={"symbol": item.symbol, "title": item.title, "stance": item.stance},
        )

    def perform_update(self, serializer):
        before = {
            "title": serializer.instance.title,
            "stance": serializer.instance.stance,
            "symbol": serializer.instance.symbol,
        }
        item = serializer.save()
        record_audit(
            actor=self.request.user,
            action="watchlist_updated",
            resource_type="WatchlistItem",
            object_id=item.pk,
            before=before,
            after={"symbol": item.symbol, "title": item.title, "stance": item.stance},
        )

    def destroy(self, request, *args, **kwargs):
        item = self.get_object()
        item.deleted_at = timezone.now()
        item.save(update_fields=["deleted_at", "updated_at"])
        record_audit(
            actor=request.user,
            action="watchlist_deleted",
            resource_type="WatchlistItem",
            object_id=item.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
