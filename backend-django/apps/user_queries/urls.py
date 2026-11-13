from django.urls import path

from .views import UserQueryCreateView

urlpatterns = [
    path("user-queries/", UserQueryCreateView.as_view(), name="user-query-create"),
]
