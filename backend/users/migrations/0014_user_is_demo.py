from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0013_cafe_sphere_and_org_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_demo",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="Общий демо-аккаунт: при выходе из демо пользовательские данные откатываются.",
            ),
        ),
    ]
