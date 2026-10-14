from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import MenuViewSet, NavigationMenuView

router = DefaultRouter()
router.register("menus", MenuViewSet, basename="menu")

urlpatterns = router.urls + [
    path("navigation/menus/", NavigationMenuView.as_view(), name="navigation-menus"),
]
