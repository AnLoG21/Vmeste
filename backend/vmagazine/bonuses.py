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


def compute_bonus_spend_cap(order_items_total: Decimal, settings_obj: ShopSettings | None, balance: Decimal) -> Decimal:
    percent = Decimal(str(getattr(settings_obj, "bonus_max_spend_percent", 50) or 50))
    if percent < 0:
        percent = Decimal("0")
    if percent > 100:
        percent = Decimal("100")
    cap = (Decimal(order_items_total) * percent / Decimal("100")).quantize(Decimal("0.01"))
    return min(Decimal(balance or 0), cap, Decimal(order_items_total)).quantize(Decimal("0.01"))


def spend_order_bonuses(order: ShopOrder, requested: Decimal | None = None) -> Decimal:
    """Списать Вбонусы с баланса клиента. Возвращает фактически списанную сумму."""
    if not order.client_id:
        return Decimal("0")
    if BonusLedgerEntry.objects.filter(order=order, kind=BonusLedgerEntry.Kind.SPEND).exists():
        return Decimal(order.bonus_spent or 0)
    settings_obj = ShopSettings.objects.filter(provider_id=order.provider_id).first()
    bal = ShopBonusBalance.objects.filter(user_id=order.client_id, provider_id=order.provider_id).first()
    balance = Decimal(bal.balance) if bal else Decimal("0")
    cap = compute_bonus_spend_cap(Decimal(order.items_total or 0), settings_obj, balance)
    want = Decimal(requested) if requested is not None else cap
    if want <= 0 or cap <= 0:
        return Decimal("0")
    amount = min(want, cap).quantize(Decimal("0.01"))
    if amount <= 0:
        return Decimal("0")
    with transaction.atomic():
        row, _ = ShopBonusBalance.objects.select_for_update().get_or_create(
            user_id=order.client_id,
            provider_id=order.provider_id,
            defaults={"balance": Decimal("0")},
        )
        available = Decimal(row.balance or 0)
        amount = min(amount, available).quantize(Decimal("0.01"))
        if amount <= 0:
            return Decimal("0")
        row.balance = available - amount
        row.save(update_fields=["balance", "updated_at"])
        BonusLedgerEntry.objects.create(
            user_id=order.client_id,
            provider_id=order.provider_id,
            kind=BonusLedgerEntry.Kind.SPEND,
            amount=amount,
            order=order,
            note="Списание при заказе",
        )
        order.bonus_spent = amount
        order.total = max(Decimal("0"), Decimal(order.total or 0) - amount).quantize(Decimal("0.01"))
        order.save(update_fields=["bonus_spent", "total", "updated_at"])
    return amount


def refund_order_bonuses(order: ShopOrder) -> None:
    """Вернуть списанные бонусы, если оплата не состоялась."""
    if not order.client_id:
        return
    spent = (
        BonusLedgerEntry.objects.filter(order=order, kind=BonusLedgerEntry.Kind.SPEND)
        .order_by("id")
        .first()
    )
    if not spent:
        return
    if BonusLedgerEntry.objects.filter(order=order, kind=BonusLedgerEntry.Kind.ADJUST, note__startswith="Возврат бонусов").exists():
        return
    amount = Decimal(spent.amount or 0)
    if amount <= 0:
        return
    with transaction.atomic():
        bal, _ = ShopBonusBalance.objects.select_for_update().get_or_create(
            user_id=order.client_id,
            provider_id=order.provider_id,
            defaults={"balance": Decimal("0")},
        )
        bal.balance = Decimal(bal.balance or 0) + amount
        bal.save(update_fields=["balance", "updated_at"])
        BonusLedgerEntry.objects.create(
            user_id=order.client_id,
            provider_id=order.provider_id,
            kind=BonusLedgerEntry.Kind.ADJUST,
            amount=amount,
            order=order,
            note="Возврат бонусов после отмены оплаты",
        )
        order.bonus_spent = Decimal("0")
        order.save(update_fields=["bonus_spent", "updated_at"])
