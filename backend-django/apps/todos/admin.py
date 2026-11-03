from django.contrib import admin

from .models import Todo


@admin.register(Todo)
class TodoAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "status",
        "priority",
        "owner",
        "assignee",
        "due_at",
        "deleted_at",
    )
    list_filter = ("status", "priority", "deleted_at")
    search_fields = ("title", "description", "owner__username", "assignee__username")
    autocomplete_fields = ("owner", "assignee")
    date_hierarchy = "created_at"
