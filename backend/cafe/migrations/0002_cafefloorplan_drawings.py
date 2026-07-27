from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cafe", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="cafefloorplan",
            name="drawings",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text="Чертёж зала: стены [{type:'wall',x1,y1,x2,y2}] и т.п.",
            ),
        ),
    ]
