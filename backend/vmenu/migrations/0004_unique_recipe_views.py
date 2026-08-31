from django.conf import settings
from django.db import migrations, models


def dedupe_views_and_recount(apps, schema_editor):
    VmenuRecipeView = apps.get_model("vmenu", "VmenuRecipeView")
    VmenuRecipe = apps.get_model("vmenu", "VmenuRecipe")
    seen = set()
    for row in VmenuRecipeView.objects.order_by("id"):
        if row.user_id is None:
            continue
        key = (row.recipe_id, row.user_id)
        if key in seen:
            row.delete()
        else:
            seen.add(key)
    for recipe in VmenuRecipe.objects.all():
        unique_views = (
            VmenuRecipeView.objects.filter(recipe_id=recipe.id, user__isnull=False)
            .values("user_id")
            .distinct()
            .count()
        )
        recipe.view_count = unique_views
        recipe.save(update_fields=["view_count"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("vmenu", "0003_vmenucommentlike"),
    ]

    operations = [
        migrations.RunPython(dedupe_views_and_recount, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="vmenurecipeview",
            constraint=models.UniqueConstraint(
                fields=("recipe", "user"),
                name="vmenu_unique_recipe_view_per_user",
            ),
        ),
    ]
