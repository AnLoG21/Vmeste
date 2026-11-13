from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("vmagnitol", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="guide",
            options={"ordering": ["sort_order", "category", "title"]},
        ),
        migrations.AlterModelOptions(
            name="guidefile",
            options={"ordering": ["-is_required", "role", "-created_at"]},
        ),
        migrations.AddField(
            model_name="guide",
            name="brick_warning",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Явные стоп-условия, при которых нельзя продолжать (кирпич).",
            ),
        ),
        migrations.AddField(
            model_name="guide",
            name="category",
            field=models.CharField(
                choices=[
                    ("identify", "Определение версии / платформы"),
                    ("prep", "Подготовка и бэкап"),
                    ("firmware", "Сток / обновление прошивки"),
                    ("community", "Community / кастом-пакет"),
                    ("russify", "Русификация"),
                    ("carplay", "Apple CarPlay"),
                    ("android_auto", "Android Auto"),
                    ("apps", "Приложения и допы"),
                    ("rollback", "Откат в сток"),
                    ("other", "Другое"),
                ],
                db_index=True,
                default="other",
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="guide",
            name="file_manifest",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Список файлов, которые должны быть приложены к гайду.",
            ),
        ),
        migrations.AddField(
            model_name="guide",
            name="risk_level",
            field=models.CharField(
                choices=[
                    ("low", "Низкий"),
                    ("medium", "Средний"),
                    ("high", "Высокий"),
                    ("critical", "Критический (риск кирпича)"),
                ],
                db_index=True,
                default="medium",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="guide",
            name="sort_order",
            field=models.PositiveIntegerField(db_index=True, default=0),
        ),
        migrations.AddField(
            model_name="guide",
            name="verified",
            field=models.CharField(
                choices=[
                    ("unverified", "Не проверено"),
                    ("community", "По отчётам сообщества"),
                    ("crosschecked", "Сверено по 2+ источникам"),
                    ("blocked", "Заблокировано (опасно / неясно)"),
                ],
                db_index=True,
                default="unverified",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="guidefile",
            name="external_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Ссылка на файл, если бинарник нельзя хранить у нас (бот/облако автора).",
            ),
        ),
        migrations.AddField(
            model_name="guidefile",
            name="is_required",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="guidefile",
            name="notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="guidefile",
            name="role",
            field=models.CharField(
                choices=[
                    ("manifest", "Манифест / чеклист"),
                    ("tool", "Инструмент"),
                    ("firmware", "Прошивка / образ"),
                    ("package", "Пакет установки"),
                    ("apk", "APK"),
                    ("doc", "Документация"),
                    ("other", "Другое"),
                ],
                db_index=True,
                default="other",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="guidestep",
            name="stop_if",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Условие STOP: если истинно — не переходить к следующему шагу.",
            ),
        ),
        migrations.AlterField(
            model_name="guidefile",
            name="file",
            field=models.FileField(blank=True, default="", upload_to="vmagnitol/files/%Y/%m/"),
        ),
    ]
