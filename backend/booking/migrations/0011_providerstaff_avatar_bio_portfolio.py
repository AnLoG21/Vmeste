from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("booking", "0010_availabilityslot_hold_label"),
    ]

    operations = [
        migrations.AddField(
            model_name="providerstaff",
            name="avatar_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="staff_avatars/%Y/%m/",
            ),
        ),
        migrations.AddField(
            model_name="providerstaff",
            name="bio",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.CreateModel(
            name="ProviderStaffPortfolioPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="staff_portfolio_photos/%Y/%m/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "staff_link",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="portfolio_photos",
                        to="booking.providerstaff",
                    ),
                ),
            ],
        ),
    ]

