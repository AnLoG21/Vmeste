from decimal import Decimal

from django.db import transaction

from shop.models import ShopOrder, ShopSettings

from .models import BonusLedgerEntry, ShopBonusBalance


def accrue_order_bonuses(order: ShopOrder) -> None:
    """Начислить Вбонусы клиенту при завершении заказа."""
    if not order.client_id:
        return
    if order.status != ShopOrder.Status.DONE:
        return
    if BonusLedgerEntry.objects.filter(order=order, kind=BonusLedgerEntry.Kind.EARN).exists():
        return
    settings_obj = ShopSettings.objects.filter(provider_id=order.provider_id).first()
    percent = Decimal(str(getattr(settings_obj, "bonus_earn_percent", 0) or 0))
    amount = Decimal("0")
    for item in order.items.select_related("product").all():
        if item.product_id and item.product and item.product.bonus_points:
            amount += Decimal(item.product.bonus_points) * Decimal(item.quantity)
        elif percent > 0:
            amount += (Decimal(item.unit_price) * Decimal(item.quantity) * percent) / Decimal("100")
    amount = amount.quantize(Decimal("0.01"))
    if amount <= 0:
        return
    with transaction.atomic():
        bal, _ = ShopBonusBalance.objects.select_for_update().get_or_create(
            user_id=order.client_id,
            provider_id=order.provider_id,
            defaults={"balance": Decimal("0")},
        )
        bal.balance = Decimal(bal.balance) + amount
        bal.save(update_fields=["balance", "updated_at"])
        BonusLedgerEntry.objects.create(
            user_id=order.client_id,
            provider_id=order.provider_id,
            kind=BonusLedgerEntry.Kind.EARN,
            amount=amount,
            order=order,
            note="Начисление за заказ",
        )
