"""Optional Sentry for Django (enabled when SENTRY_DSN is set)."""

from __future__ import annotations

import os


def init_sentry() -> None:
    dsn = (os.environ.get("SENTRY_DSN") or "").strip()
    if not dsn:
        return
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration

    traces = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05") or "0.05")
    sentry_sdk.init(
        dsn=dsn,
        integrations=[DjangoIntegration(), CeleryIntegration()],
        traces_sample_rate=traces,
        send_default_pii=False,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
    )
