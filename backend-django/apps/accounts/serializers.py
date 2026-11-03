"""Serializers for authentication and setup flows."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from common.utils import is_valid_username, normalize_email, normalize_username

User = get_user_model()


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "username", "email", "is_active", "is_protected_admin"]


class BootstrapSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    signup_code = serializers.CharField(write_only=True)

    def validate_username(self, value):
        username = normalize_username(value)
        if not is_valid_username(username):
            raise serializers.ValidationError(
                "Username must be 3-150 characters (letters, numbers, . _ @ + -)."
            )
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError("Username already exists.")
        return username

    def validate_email(self, value):
        email = normalize_email(value)
        if email and User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Email already exists.")
        return email

    def validate(self, attrs):
        configured = getattr(settings, "ADMIN_SIGNUP_CODE", "")
        if not configured:
            raise serializers.ValidationError(
                {"signup_code": "Admin signup is not configured on the server."}
            )
        if attrs.get("signup_code") != configured:
            raise serializers.ValidationError(
                {"signup_code": "Invalid admin signup code."}
            )
        try:
            validate_password(attrs["password"])
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)


class UserAdminSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "name",
            "username",
            "email",
            "is_active",
            "is_staff",
            "is_superuser",
            "is_protected_admin",
            "roles",
            "last_login",
            "created_at",
            "updated_at",
            "deleted_at",
        ]
        read_only_fields = fields

    def get_roles(self, obj):
        return sorted(
            obj.user_roles.values_list("role__code", flat=True)
        )


class UserCreateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    is_active = serializers.BooleanField(default=True)

    def validate_username(self, value):
        username = normalize_username(value)
        if not is_valid_username(username):
            raise serializers.ValidationError(
                "Username must be 3-150 characters (letters, numbers, . _ @ + -)."
            )
        if User.objects.filter(username=username).exists():
            raise serializers.ValidationError("Username already exists.")
        return username

    def validate_email(self, value):
        email = normalize_email(value)
        if email and User.objects.filter(email=email).exists():
            raise serializers.ValidationError("Email already exists.")
        return email

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class UserUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    is_active = serializers.BooleanField(required=False)
    password = serializers.CharField(
        write_only=True, required=False, allow_blank=True, min_length=8
    )

    def validate_email(self, value):
        email = normalize_email(value)
        if email:
            qs = User.objects.filter(email=email)
            if self.instance is not None:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Email already exists.")
        return email

    def validate_password(self, value):
        if not value:
            return value
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value
