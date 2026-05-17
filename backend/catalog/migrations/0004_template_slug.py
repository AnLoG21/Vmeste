from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0003_alter_service_category"),
    ]

    operations = [
        migrations.AddField(
            model_name="servicecategory",
            name="template_slug",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="servicesubcategory",
            name="template_slug",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="service",
            name="template_slug",
            field=models.CharField(blank=True, db_index=True, default="", max_length=80),
        ),
        migrations.AddConstraint(
            model_name="servicecategory",
            constraint=models.UniqueConstraint(
                condition=models.Q(("template_slug__gt", "")),
                fields=("provider", "template_slug"),
                name="uniq_provider_category_template_slug",
            ),
        ),
        migrations.AddConstraint(
            model_name="servicesubcategory",
            constraint=models.UniqueConstraint(
                condition=models.Q(("template_slug__gt", "")),
                fields=("category", "template_slug"),
                name="uniq_category_subcategory_template_slug",
            ),
        ),
        migrations.AddConstraint(
            model_name="service",
            constraint=models.UniqueConstraint(
                condition=models.Q(("template_slug__gt", "")),
                fields=("provider", "template_slug"),
                name="uniq_provider_service_template_slug",
            ),
        ),
    ]
