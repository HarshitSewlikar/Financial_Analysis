import pytest
from django.test import Client, override_settings
from django.urls import Resolver404, resolve


@override_settings(ALLOWED_HOSTS=["testserver"])
def test_admin_route_is_not_resolvable_and_returns_404():
    with pytest.raises(Resolver404):
        resolve("/admin/")

    response = Client().get("/admin/")

    assert response.status_code == 404
