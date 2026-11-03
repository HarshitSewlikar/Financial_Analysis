from __future__ import annotations

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from access_control.permissions import HasPermission
from audit.services import record_audit

from .models import Menu
from .serializers import MenuSerializer
from .services import visible_menus_for


class MenuViewSet(viewsets.ModelViewSet):
    queryset = Menu.objects.all()
    serializer_class = MenuSerializer
    search_fields = ["code", "label", "path"]
    ordering_fields = ["sort_order", "label", "code"]
    filterset_fields = ["is_active", "parent"]

    def get_permissions(self):
        if self.action in {"list", "retrieve"}:
            return [HasPermission("menus.read")()]
        return [HasPermission("menus.manage")()]

    def perform_create(self, serializer):
        menu = serializer.save()
        record_audit(
            actor=self.request.user,
            action="menu_created",
            resource_type="Menu",
            object_id=menu.pk,
            after={"code": menu.code, "required_permission": menu.required_permission},
        )

    def perform_update(self, serializer):
        menu = serializer.save()
        record_audit(
            actor=self.request.user,
            action="menu_updated",
            resource_type="Menu",
            object_id=menu.pk,
            after={"code": menu.code, "is_active": menu.is_active},
        )

    def destroy(self, request, *args, **kwargs):
        menu = self.get_object()
        menu.is_active = False
        menu.save(update_fields=["is_active", "updated_at"])
        record_audit(
            actor=request.user,
            action="menu_deactivated",
            resource_type="Menu",
            object_id=menu.pk,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class NavigationMenuView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"menus": visible_menus_for(request.user)})
