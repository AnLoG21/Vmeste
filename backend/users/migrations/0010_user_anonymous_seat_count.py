from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0009_user_organization_websites"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="anonymous_seat_count",
            field=models.PositiveSmallIntegerField(
                default=0,
                help_text="Сколько мест «Без сотрудников N» доступно в календаре интервалов.",
            ),
        ),
    ]
