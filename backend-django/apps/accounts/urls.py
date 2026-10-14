from django.urls import path

from .views import (
    BootstrapView,
    CsrfCookieView,
    LoginView,
    LogoutView,
    MeAccessView,
    MeView,
    RefreshView,
    SetupStatusView,
)

urlpatterns = [
    path("setup-status/", SetupStatusView.as_view(), name="setup-status"),
    path("bootstrap/", BootstrapView.as_view(), name="bootstrap"),
    path("login/", LoginView.as_view(), name="login"),
    path("token/refresh/", RefreshView.as_view(), name="token-refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("me/access/", MeAccessView.as_view(), name="me-access"),
    path("csrf/", CsrfCookieView.as_view(), name="csrf"),
]
