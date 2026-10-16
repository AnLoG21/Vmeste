from django.apps import AppConfig


class VkvartireConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "vkvartire"
    verbose_name = "Вквартире — подбор квартир"

    def ready(self):
        from . import signals  # noqa: F401
