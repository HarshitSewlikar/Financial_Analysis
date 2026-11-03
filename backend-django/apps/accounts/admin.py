from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import LoginAttempt, SetupState, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "name",
        "email",
        "is_active",
        "is_protected_admin",
        "is_staff",
        "last_login",
    )
    list_filter = ("is_active", "is_protected_admin", "is_staff", "is_superuser")
    search_fields = ("username", "name", "email")
    ordering = ("username",)
    readonly_fields = ("created_at", "updated_at", "deleted_at", "last_login")

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        ("Profile", {"fields": ("name", "email")}),
        (
            "Status",
            {
                "fields": (
                    "is_active",
                    "is_protected_admin",
                    "is_staff",
                    "is_superuser",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "created_at", "updated_at", "deleted_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "name", "email", "password1", "password2", "is_active"),
            },
        ),
    )


@admin.register(SetupState)
class SetupStateAdmin(admin.ModelAdmin):
    list_display = ("id", "is_bootstrapped", "bootstrap_admin", "completed_at", "updated_at")
    readonly_fields = ("id", "completed_at", "updated_at")


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("username", "ip_address", "successful", "created_at")
    list_filter = ("successful",)
    search_fields = ("username", "ip_address")
    readonly_fields = ("username", "ip_address", "successful", "created_at")
