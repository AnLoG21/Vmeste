import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vkvartire", "0002_savedsearch"),
    ]

    operations = [
        migrations.AddField(
            model_name="listing",
            name="realtor",
            field=models.ForeignKey(
                blank=True,
                help_text="Пользователь Вместе для чата по объявлению",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="vkvartire_listings",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="listing",
            name="realtor_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="listing",
            name="realtor_name",
            field=models.CharField(blank=True, default="", max_length=160),
        ),
        migrations.AddField(
            model_name="listing",
            name="realtor_phone",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
    ]
