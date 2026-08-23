from celery import shared_task


@shared_task(name="voice.run_outbound_confirmations")
def run_outbound_confirmations_task(provider_id: int | None = None):
    from .models import ProviderVoiceSettings
    from .outbound import run_outbound_confirmations

    if provider_id:
        return run_outbound_confirmations(int(provider_id))
    total = {"dialed": 0, "providers": 0, "errors": []}
    for vs in ProviderVoiceSettings.objects.filter(enabled=True, confirm_outbound_enabled=True):
        r = run_outbound_confirmations(vs.provider_id, limit=15)
        total["providers"] += 1
        total["dialed"] += int(r.get("dialed") or 0)
        if r.get("errors"):
            total["errors"].extend(r["errors"])
    return total


@shared_task(name="voice.run_all_outbound_confirmations")
def run_all_outbound_confirmations_task():
    return run_outbound_confirmations_task(None)
