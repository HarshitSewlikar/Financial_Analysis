from rest_framework.routers import DefaultRouter

from .views import WatchlistItemViewSet

router = DefaultRouter()
router.register("watchlist", WatchlistItemViewSet, basename="watchlist")

urlpatterns = router.urls
