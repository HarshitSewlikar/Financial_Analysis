"""JWT authentication that resolves identity from MySQL on every request."""

from __future__ import annotations

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class DatabaseJWTAuthentication(JWTAuthentication):
    """Access tokens carry identity only; authorization is resolved per request.

    The base class already reloads the user from the database each request.
    We additionally reject soft-deleted or inactive accounts, and never trust
    role/permission claims in the token.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if user is None or not user.is_active or user.deleted_at is not None:
            raise AuthenticationFailed(
                "User is inactive or no longer exists.", code="user_inactive"
            )
        return user
