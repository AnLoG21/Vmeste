from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

from vmenu.cuisine_data import DEFAULT_CUISINES


def seed_cuisines(apps, schema_editor):
    VmenuCuisine = apps.get_model("vmenu", "VmenuCuisine")
    for slug, name, order in DEFAULT_CUISINES:
        VmenuCuisine.objects.get_or_create(slug=slug, defaults={"name": name, "sort_order": order})


class Migration(migrations.Migration):
    dependencies = [
        ("vmenu", "0004_unique_recipe_views"),
    ]

    operations = [
        migrations.CreateModel(
            name="VmenuCuisine",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
            ],
            options={"ordering": ["sort_order", "name"]},
        ),
        migrations.AddField(
            model_name="vmenurecipe",
            name="cuisine",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="recipes",
                to="vmenu.vmenucuisine",
            ),
        ),
        migrations.RunPython(seed_cuisines, migrations.RunPython.noop),
    ]
