from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"

    def ready(self):
        # Image post-processing disabled: sync Pillow on save blocked the 1GB VPS.
        pass
