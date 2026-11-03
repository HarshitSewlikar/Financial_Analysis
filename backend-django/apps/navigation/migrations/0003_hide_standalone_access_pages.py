"""Remove Permissions and Menus from role navigation.

The menu definitions stay. Visibility is assigned again from the role screen.
"""

from django.db import migrations


def hide_standalone_pages(apps, schema_editor):
    Menu = apps.get_model("navigation", "Menu")
    RoleMenu = apps.get_model("navigation", "RoleMenu")
    menu_ids = Menu.objects.filter(code__in=["permissions", "menus"]).values_list(
        "id", flat=True
    )
    RoleMenu.objects.filter(menu_id__in=list(menu_ids)).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("navigation", "0002_menu_required_permission"),
    ]

    operations = [
        migrations.RunPython(hide_standalone_pages, migrations.RunPython.noop),
    ]
