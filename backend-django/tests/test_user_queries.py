import pytest

from user_queries.models import UserQuery


@pytest.mark.django_db
def test_submit_query_uses_the_authenticated_user(auth_api):
    api, user = auth_api()
    response = api.post(
        "/api/v1/user-queries/",
        {
            "subject": "  Chart is blank  ",
            "category": "technical",
            "description": "  The daily chart does not draw.  ",
            "user": 999,
            "status": "resolved",
            "admin_response": "ignore me",
        },
        format="json",
    )

    assert response.status_code == 201
    saved = UserQuery.objects.get()
    assert saved.user_id == user.id
    assert saved.subject == "Chart is blank"
    assert saved.description == "The daily chart does not draw."
    assert saved.category == "technical"
    assert saved.status == "open"
    assert saved.admin_response in (None, "")


@pytest.mark.django_db
def test_submit_query_requires_login(api):
    response = api.post(
        "/api/v1/user-queries/",
        {"subject": "Hi", "category": "other", "description": "Hello"},
        format="json",
    )
    assert response.status_code == 401
    assert UserQuery.objects.count() == 0


@pytest.mark.django_db
def test_submit_query_rejects_blank_or_unknown_category(auth_api):
    api, _user = auth_api()
    response = api.post(
        "/api/v1/user-queries/",
        {"subject": "   ", "category": "nope", "description": ""},
        format="json",
    )
    assert response.status_code == 400
    assert UserQuery.objects.count() == 0
