from django.db import migrations, models


MAP_HIDDEN_USERNAMES = (
    "a.loginov149",
    "a.loginov150",
    "a.loginov154",
    "a.loginov22",
    "арина",
)


def hide_test_map_accounts(apps, schema_editor):
    User = apps.get_model("users", "User")
    for username in MAP_HIDDEN_USERNAMES:
        User.objects.filter(username__iexact=username).update(map_hidden=True)


def unhide_test_map_accounts(apps, schema_editor):
    User = apps.get_model("users", "User")
    for username in MAP_HIDDEN_USERNAMES:
        User.objects.filter(username__iexact=username).update(map_hidden=False)


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0018_rename_service_center_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="map_hidden",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="Скрыть организацию на карте и в публичном каталоге (тестовые аккаунты).",
            ),
        ),
        migrations.RunPython(hide_test_map_accounts, unhide_test_map_accounts),
    ]
