"""Public health check for load balancer / uptime monitors."""

from __future__ import annotations

from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def health(request):
    checks = {"db": False}
    try:
        connection.ensure_connection()
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        checks["db"] = True
    except Exception as exc:
        checks["db_error"] = str(exc)[:200]

    try:
        from voice.speechkit import speechkit_ready

        checks["speechkit"] = bool(speechkit_ready())
    except Exception:
        checks["speechkit"] = False

    try:
        from voice.asterisk_ami import asterisk_ami_ready

        checks["asterisk_ami"] = bool(asterisk_ami_ready())
    except Exception:
        checks["asterisk_ami"] = False

    ok = bool(checks.get("db"))
    return JsonResponse(
        {"status": "ok" if ok else "degraded", "checks": checks},
        status=200 if ok else 503,
    )
