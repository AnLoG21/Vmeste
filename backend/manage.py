#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    # Windows + libpq: любые переменные PG* из системы (часто с неверной кодировкой) ломают psycopg2.connect (UnicodeDecodeError).
    for _k in list(os.environ.keys()):
        if _k.startswith("PG"):
            os.environ.pop(_k, None)
    os.environ.pop("DATABASE_URL", None)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
