"""Store per-user menu visibility and hide the standalone access pages.

The Permissions and Menus screens stay in the database. They are not in the
default sidebar; a role can turn them on again from the role screen.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def hide_standalone_pages(apps, schema_editor):
    Menu = apps.get_model("navigation", "Menu")
    RoleMenu = apps.get_model("navigation", "RoleMenu")
    menu_ids = Menu.objects.filter(code__in=["permissions", "menus"]).values_list(
        "id", flat=True
    )
    RoleMenu.objects.filter(menu_id__in=list(menu_ids)).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("navigation", "0003_hide_standalone_access_pages"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserMenuOverride",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "effect",
                    models.CharField(
                        choices=[("SHOW", "Show"), ("HIDE", "Hide")],
                        max_length=4,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "granted_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "menu",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="user_overrides",
                        to="navigation.menu",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="menu_overrides",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="usermenuoverride",
            constraint=models.UniqueConstraint(
                fields=("user", "menu"), name="uq_user_menu_override"
            ),
        ),
        migrations.RunPython(hide_standalone_pages, migrations.RunPython.noop),
    ]
