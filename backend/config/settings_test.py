"""SQLite settings for local test runs without Postgres."""

from config.settings import *  # noqa: F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Avoid Redis/Celery side effects in unit tests when missing.
CELERY_TASK_ALWAYS_EAGER = True
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }
}
