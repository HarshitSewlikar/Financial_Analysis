"""Authentication, bootstrap and access endpoints."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from access_control import policy
from audit.services import record_audit
from common.context import get_request_context
from navigation.services import visible_menus_for

from .models import SetupState
from .serializers import BootstrapSerializer, LoginSerializer, UserPublicSerializer
from .services import (
    AlreadyBootstrapped,
    SignupNotConfigured,
    bootstrap_admin,
    is_locked_out,
    record_login_attempt,
)
from .tokens import clear_refresh_cookie, issue_tokens, set_refresh_cookie

User = get_user_model()


def _client_ip(request):
    return get_request_context().get("ip_address")


class SetupStatusView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        state = SetupState.objects.filter(pk=1).first()
        return Response({"setup_complete": bool(state and state.is_bootstrapped)})


class CsrfCookieView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"detail": "CSRF cookie set."})


class BootstrapView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "bootstrap"

    def post(self, request):
        state = SetupState.objects.filter(pk=1).first()
        if state and state.is_bootstrapped:
            return Response(
                {"error": {"code": "setup_complete", "detail": "Setup is already complete."}},
                status=status.HTTP_410_GONE,
            )

        serializer = BootstrapSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            user = bootstrap_admin(
                username=data["username"],
                password=data["password"],
                name=data.get("name", ""),
                email=data.get("email", ""),
            )
        except SignupNotConfigured:
            return Response(
                {"error": {"code": "not_configured", "detail": "Admin signup is not configured."}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AlreadyBootstrapped:
            return Response(
                {"error": {"code": "setup_complete", "detail": "Setup is already complete."}},
                status=status.HTTP_410_GONE,
            )

        record_audit(
            actor=user,
            action="bootstrap_admin",
            resource_type="User",
            object_id=user.pk,
            after={"username": user.username, "is_protected_admin": True},
        )

        access, refresh = issue_tokens(user)
        response = Response(
            {"access": access, "user": UserPublicSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )
        set_refresh_cookie(response, refresh)
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        username = serializer.validated_data["username"].strip().lower()
        password = serializer.validated_data["password"]
        ip = _client_ip(request)

        if is_locked_out(username, ip):
            return Response(
                {"error": {"code": "locked_out", "detail": "Too many failed attempts. Try again later."}},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        user = User.objects.filter(username=username, deleted_at__isnull=True).first()
        if user is None or not user.check_password(password) or not user.is_active:
            record_login_attempt(username, ip, successful=False)
            record_audit(
                actor=None,
                action="login_failed",
                resource_type="User",
                object_id=username,
            )
            return Response(
                {"error": {"code": "invalid_credentials", "detail": "Invalid username or password."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        record_login_attempt(username, ip, successful=True)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        record_audit(
            actor=user,
            action="login_succeeded",
            resource_type="User",
            object_id=user.pk,
        )

        access, refresh = issue_tokens(user)
        response = Response({"access": access, "user": UserPublicSerializer(user).data})
        set_refresh_cookie(response, refresh)
        return response


@method_decorator(csrf_protect, name="dispatch")
class RefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "refresh"

    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if not token:
            return Response(
                {"error": {"code": "no_refresh", "detail": "No refresh token."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = TokenRefreshSerializer(data={"refresh": token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response(
                {"error": {"code": "invalid_refresh", "detail": "Invalid or expired refresh token."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response

        data = serializer.validated_data
        response = Response({"access": data["access"]})
        if "refresh" in data:
            set_refresh_cookie(response, data["refresh"])
        return response


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.COOKIES.get(settings.REFRESH_COOKIE_NAME)
        if token:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken

                RefreshToken(token).blacklist()
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_refresh_cookie(response)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": UserPublicSerializer(request.user).data})


class MeAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        snapshot = policy.permissions_snapshot(request.user)
        return Response(
            {
                "permissions": snapshot["permissions"],
                "is_protected_admin": snapshot["is_protected_admin"],
                "menus": visible_menus_for(request.user),
            }
        )
