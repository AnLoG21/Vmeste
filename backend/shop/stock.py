from decimal import Decimal

from django.db import transaction
from django.db.models import F

from .models import Product, StockMovement


class InsufficientStock(Exception):
    def __init__(self, product, need, have):
        self.product = product
        self.need = need
        self.have = have
        super().__init__(f"Недостаточно «{product.name}»: нужно {need}, есть {have}")


@transaction.atomic
def apply_stock_change(
    *,
    product: Product,
    kind: str,
    qty: Decimal,
    provider,
    reason: str = "",
    booking=None,
    shop_order=None,
    created_by=None,
    idempotency_key: str = "",
    allow_negative: bool = False,
) -> StockMovement | None:
    qty = Decimal(str(qty))
    if qty == 0:
        return None
    if idempotency_key:
        existing = StockMovement.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    product = Product.objects.select_for_update().get(pk=product.pk)
    signed = qty
    if kind in (
        StockMovement.Kind.OUT_MANUAL,
        StockMovement.Kind.OUT_SERVICE,
        StockMovement.Kind.OUT_ORDER,
    ):
        signed = -abs(qty)
        qty = abs(qty)
    elif kind == StockMovement.Kind.IN:
        signed = abs(qty)
        qty = abs(qty)

    new_qty = Decimal(product.stock_qty) + signed
    if new_qty < 0 and not allow_negative:
        raise InsufficientStock(product, abs(signed), product.stock_qty)

    Product.objects.filter(pk=product.pk).update(stock_qty=F("stock_qty") + signed)
    product.refresh_from_db(fields=["stock_qty"])

    return StockMovement.objects.create(
        provider=provider,
        product=product,
        kind=kind,
        qty=qty,
        reason=reason or "",
        booking=booking,
        shop_order=shop_order,
        created_by=created_by,
        idempotency_key=idempotency_key or "",
    )


def writeoff_booking_materials(booking, *, actor=None) -> list[StockMovement]:
    """Списать нормы расхода услуги при завершении записи."""
    from .models import ServiceMaterial

    service = getattr(booking, "service", None)
    if not service:
        return []
    materials = list(
        ServiceMaterial.objects.filter(service=service).select_related("product")
    )
    if not materials:
        return []
    out = []
    for mat in materials:
        key = f"booking:{booking.id}:product:{mat.product_id}"
        try:
            mv = apply_stock_change(
                product=mat.product,
                kind=StockMovement.Kind.OUT_SERVICE,
                qty=mat.qty_per_service,
                provider=booking.provider,
                reason=f"Услуга «{service.name}», запись #{booking.id}",
                booking=booking,
                created_by=actor,
                idempotency_key=key,
                allow_negative=True,
            )
            if mv:
                out.append(mv)
        except InsufficientStock:
            # allow_negative=True should prevent this; keep for safety
            mv = apply_stock_change(
                product=mat.product,
                kind=StockMovement.Kind.OUT_SERVICE,
                qty=mat.qty_per_service,
                provider=booking.provider,
                reason=f"Услуга «{service.name}», запись #{booking.id} (нехватка)",
                booking=booking,
                created_by=actor,
                idempotency_key=key,
                allow_negative=True,
            )
            if mv:
                out.append(mv)
    return out


@transaction.atomic
def writeoff_shop_order(order, *, actor=None) -> list[StockMovement]:
    if order.stock_written_off:
        return list(order.stock_movements.filter(kind=StockMovement.Kind.OUT_ORDER))
    out = []
    for line in order.items.select_related("product").all():
        if not line.product_id:
            continue
        key = f"shop_order:{order.id}:product:{line.product_id}:line:{line.id}"
        mv = apply_stock_change(
            product=line.product,
            kind=StockMovement.Kind.OUT_ORDER,
            qty=Decimal(line.quantity),
            provider=order.provider,
            reason=f"Заказ магазина #{order.id}",
            shop_order=order,
            created_by=actor,
            idempotency_key=key,
            allow_negative=True,
        )
        if mv:
            out.append(mv)
    order.stock_written_off = True
    order.save(update_fields=["stock_written_off"])
    return out
