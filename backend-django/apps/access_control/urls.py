from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import PermissionViewSet, RoleViewSet, UserPermissionOverridesView, UserRolesView

router = DefaultRouter()
router.register("roles", RoleViewSet, basename="role")
router.register("permissions", PermissionViewSet, basename="permission")

urlpatterns = router.urls + [
    path(
        "users/<int:user_id>/roles/",
        UserRolesView.as_view(),
        name="user-roles",
    ),
    path(
        "users/<int:user_id>/permission-overrides/",
        UserPermissionOverridesView.as_view(),
        name="user-permission-overrides",
    ),
]
