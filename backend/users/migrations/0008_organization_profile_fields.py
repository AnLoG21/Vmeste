from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_user_booking_done_message_default"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="organization_card_note",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Дополнительная информация в карточке организации.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="organization_phones",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Телефоны организации для клиентов.",
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="organization_working_hours",
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text="Расписание: ключи mon..sun, значения {open, close, closed}.",
            ),
        ),
        migrations.CreateModel(
            name="ProviderGalleryPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="org_gallery/%Y/%m/")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=models.deletion.CASCADE,
                        related_name="gallery_photos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
    ]
