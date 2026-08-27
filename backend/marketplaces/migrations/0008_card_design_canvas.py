from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketplaces", "0007_marketplace_card_design"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketplacecarddesign",
            name="canvas",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
