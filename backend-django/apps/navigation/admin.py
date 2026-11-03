from django.contrib import admin

from .models import Menu, RoleMenu


@admin.register(Menu)
class MenuAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "label",
        "path",
        "component_key",
        "required_permission",
        "parent",
        "sort_order",
        "is_active",
    )
    list_filter = ("is_active", "component_key")
    search_fields = ("code", "label", "path")
    ordering = ("sort_order", "label")


@admin.register(RoleMenu)
class RoleMenuAdmin(admin.ModelAdmin):
    list_display = ("role", "menu", "granted_by", "created_at")
    autocomplete_fields = ("role", "menu")
