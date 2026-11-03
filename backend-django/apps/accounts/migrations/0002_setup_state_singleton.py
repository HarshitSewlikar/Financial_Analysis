from django.db import migrations


def create_setup_state(apps, schema_editor):
    SetupState = apps.get_model("accounts", "SetupState")
    SetupState.objects.get_or_create(pk=1, defaults={"is_bootstrapped": False})


def delete_setup_state(apps, schema_editor):
    SetupState = apps.get_model("accounts", "SetupState")
    SetupState.objects.filter(pk=1).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial")]

    operations = [migrations.RunPython(create_setup_state, delete_setup_state)]
