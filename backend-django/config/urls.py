from django.urls import include, path

from config.health import HealthView

api_v1_patterns = [
    path("auth/", include("accounts.urls")),
    path("", include("access_control.urls")),
    path("", include("accounts.api_urls")),
    path("", include("navigation.urls")),
    path("", include("todos.urls")),
    path("", include("audit.urls")),
    path("", include("market_data.urls")),
]

urlpatterns = [
    path("api/health/", HealthView.as_view(), name="health"),
    path("api/v1/", include(api_v1_patterns)),
]
