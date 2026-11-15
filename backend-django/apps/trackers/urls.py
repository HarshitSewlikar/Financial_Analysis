from rest_framework.routers import DefaultRouter

from .views import TrackerViewSet

router = DefaultRouter()
router.register("trackers", TrackerViewSet, basename="tracker")

urlpatterns = router.urls
