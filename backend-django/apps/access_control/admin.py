from django.contrib import admin

from .models import (
    Permission,
    Role,
    RolePermission,
    UserPermissionOverride,
    UserRole,
)


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 0
    autocomplete_fields = ("permission",)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "is_system", "is_active", "deleted_at")
    list_filter = ("is_system", "is_active")
    search_fields = ("code", "name", "description")
    inlines = [RolePermissionInline]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("code", "resource", "action", "is_system", "is_active")
    list_filter = ("resource", "action", "is_system", "is_active")
    search_fields = ("code", "resource", "action", "description")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("role", "permission", "granted_by", "created_at")
    autocomplete_fields = ("role", "permission")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "assigned_by", "assigned_at", "expires_at")
    search_fields = ("user__username", "role__code")
    autocomplete_fields = ("user", "role")


@admin.register(UserPermissionOverride)
class UserPermissionOverrideAdmin(admin.ModelAdmin):
    list_display = ("user", "permission", "effect", "granted_by", "updated_at")
    list_filter = ("effect",)
    search_fields = ("user__username", "permission__code")
    autocomplete_fields = ("user", "permission")
