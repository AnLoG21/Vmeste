from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0008_organization_profile_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="organization_websites",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Сайты организации для клиентов (URL).",
            ),
        ),
    ]
