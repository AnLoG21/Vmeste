"""Аналитика заказов магазина / склада."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User

from .access import can_manage_shop, resolve_shop_provider
from .models import ShopOrder

try:
    from vmagazine.models import ReturnRequest
except Exception:  # pragma: no cover
    ReturnRequest = None


REVENUE_STATUSES = {
    ShopOrder.Status.PAID,
    ShopOrder.Status.ASSEMBLING,
    ShopOrder.Status.READY,
    ShopOrder.Status.TO_COURIER,
    ShopOrder.Status.DELIVERING,
    ShopOrder.Status.DONE,
}


class ShopAnalyticsSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа к магазину."}, status=status.HTTP_403_FORBIDDEN)
        provider = resolve_shop_provider(request.user)
        if not provider:
            return Response({"detail": "Магазин не найден."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        date_from = parse_date(request.query_params.get("from") or "") or (today - timedelta(days=30))
        date_to = parse_date(request.query_params.get("to") or "") or today
        if date_from > date_to:
            date_from, date_to = date_to, date_from

        start_dt = timezone.make_aware(datetime.combine(date_from, datetime.min.time()))
        end_dt = timezone.make_aware(datetime.combine(date_to, datetime.max.time()))

        orders = (
            ShopOrder.objects.filter(provider=provider, created_at__gte=start_dt, created_at__lte=end_dt)
            .prefetch_related("items")
            .order_by("-created_at")
        )

        by_status = {s: 0 for s, _ in ShopOrder.Status.choices}
        by_mode = {m: {"count": 0, "revenue": Decimal("0")} for m, _ in ShopOrder.Mode.choices}
        by_day = defaultdict(lambda: {"count": 0, "done": 0, "revenue": Decimal("0")})
        by_item = defaultdict(lambda: {"id": None, "name": "", "count": 0, "revenue": Decimal("0")})
        by_channel = defaultdict(lambda: {"count": 0, "revenue": Decimal("0")})
        revenue = Decimal("0")
        revenue_orders = 0
        rows = []

        for o in orders:
            by_status[o.status] = by_status.get(o.status, 0) + 1
            day = timezone.localtime(o.created_at).date().isoformat()
            by_day[day]["count"] += 1
            total = Decimal(str(o.total or 0))
            channel = (o.chosen_delivery_provider or o.mode or "other").strip() or "other"
            by_channel[channel]["count"] += 1

            if o.status in REVENUE_STATUSES:
                revenue += total
                revenue_orders += 1
                by_day[day]["revenue"] += total
                by_mode[o.mode]["revenue"] += total
                by_channel[channel]["revenue"] += total
            if o.status == ShopOrder.Status.DONE:
                by_day[day]["done"] += 1
            by_mode[o.mode]["count"] += 1

            for line in o.items.all():
                key = line.product_id or f"n:{line.name}"
                by_item[key]["id"] = line.product_id
                by_item[key]["name"] = line.name
                by_item[key]["count"] += int(line.quantity or 0)
                if o.status in REVENUE_STATUSES:
                    by_item[key]["revenue"] += Decimal(str(line.line_total or 0))

            guest = (o.guest_name or "").strip() or (o.guest_phone or "").strip() or "—"
            rows.append(
                {
                    "id": o.id,
                    "created_at": o.created_at.isoformat(),
                    "status": o.status,
                    "mode": o.mode,
                    "total": float(total),
                    "guest": guest,
                    "channel": channel,
                    "delivery_fee": float(o.delivery_fee or 0),
                }
            )

        returns_count = 0
        returns_approved = 0
        if ReturnRequest is not None:
            rets = ReturnRequest.objects.filter(
                order__provider=provider,
                created_at__gte=start_dt,
                created_at__lte=end_dt,
            )
            returns_count = rets.count()
            returns_approved = rets.filter(
                status__in=[
                    getattr(ReturnRequest.Status, "APPROVED", "approved"),
                    getattr(ReturnRequest.Status, "DONE", "done"),
                ]
            ).count()

        days = []
        cur = date_from
        while cur <= date_to:
            key = cur.isoformat()
            cell = by_day[key]
            days.append(
                {
                    "date": key,
                    "orders": cell["count"],
                    "done": cell["done"],
                    "revenue": float(cell["revenue"]),
                }
            )
            cur += timedelta(days=1)

        avg_check = float(revenue / revenue_orders) if revenue_orders else 0.0

        return Response(
            {
                "kind": "shop",
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "totals": {
                    "orders": len(rows),
                    "by_status": by_status,
                    "by_mode": {k: v["count"] for k, v in by_mode.items()},
                    "revenue_estimate": float(revenue),
                    "average_check": round(avg_check, 2),
                    "returns_count": returns_count,
                    "returns_approved": returns_approved,
                },
                "by_day": days,
                "by_item": sorted(
                    (
                        {
                            "id": v["id"],
                            "name": v["name"],
                            "count": v["count"],
                            "revenue": float(v["revenue"]),
                        }
                        for v in by_item.values()
                        if v["count"]
                    ),
                    key=lambda x: -x["count"],
                ),
                "by_mode_detail": sorted(
                    (
                        {
                            "mode": k,
                            "count": v["count"],
                            "revenue": float(v["revenue"]),
                        }
                        for k, v in by_mode.items()
                        if v["count"]
                    ),
                    key=lambda x: -x["count"],
                ),
                "by_channel": sorted(
                    (
                        {
                            "channel": k,
                            "count": v["count"],
                            "revenue": float(v["revenue"]),
                        }
                        for k, v in by_channel.items()
                        if v["count"]
                    ),
                    key=lambda x: -x["count"],
                ),
                "orders": rows,
            }
        )
