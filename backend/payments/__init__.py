"""Multi-provider acquiring adapters (YooKassa, T-Bank, CloudPayments, Robokassa)."""

from .gateway import PROVIDERS, create_org_payment, provider_ready, sync_payment_status
from .resolve import resolve_org_payment_setup

__all__ = [
    "PROVIDERS",
    "create_org_payment",
    "provider_ready",
    "sync_payment_status",
    "resolve_org_payment_setup",
]
