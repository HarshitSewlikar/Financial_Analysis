from __future__ import annotations

from rest_framework import viewsets

from access_control.permissions import HasPermission

from .models import Menu
from .serializers import MenuSerializer


class MenuViewSet(viewsets.ReadOnlyModelViewSet):
    """Page catalog. Role assignment is /api/v1/roles/{id}/menus/."""

    queryset = Menu.objects.all()
    serializer_class = MenuSerializer
    permission_classes = [HasPermission("menus.read")]
    search_fields = ["code", "label", "path"]
    ordering_fields = ["sort_order", "label", "code"]
    filterset_fields = ["is_active", "parent"]
