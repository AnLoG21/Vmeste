from celery import shared_task


@shared_task(name="marketplaces.sync_pending_imports")
def sync_pending_imports_task():
    from .sync import sync_pending_ozon_imports

    return sync_pending_ozon_imports(limit=50)


@shared_task(name="marketplaces.sync_provider")
def sync_provider_task(provider_id: int):
    from django.contrib.auth import get_user_model

    from .sync import sync_provider_marketplace

    User = get_user_model()
    provider = User.objects.filter(id=provider_id).first()
    if not provider:
        return {"ok": False, "error": "provider_not_found"}
    return sync_provider_marketplace(provider)
