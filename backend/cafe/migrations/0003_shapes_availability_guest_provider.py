import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def fill_session_provider(apps, schema_editor):
    CafeGuestSession = apps.get_model("cafe", "CafeGuestSession")
    for sess in CafeGuestSession.objects.select_related("table__floor_plan").all():
        if sess.table_id and not sess.provider_id:
            sess.provider_id = sess.table.floor_plan.provider_id
            sess.save(update_fields=["provider_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0002_cafefloorplan_drawings"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="cafetable",
            name="shape",
            field=models.CharField(
                choices=[("round", "Круглый"), ("rect", "Прямоугольный"), ("sofa", "Диванный")],
                default="round",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="cafemenuitem",
            name="is_available",
            field=models.BooleanField(default=True, help_text="Есть в наличии"),
        ),
        migrations.AddField(
            model_name="cafemenuitem",
            name="rating_sum",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="cafemenuitem",
            name="rating_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="cafeguestsession",
            name="provider",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="cafe_guest_sessions",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AlterField(
            model_name="cafeguestsession",
            name="table",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="sessions",
                to="cafe.cafetable",
            ),
        ),
        migrations.RunPython(fill_session_provider, migrations.RunPython.noop),
    ]
