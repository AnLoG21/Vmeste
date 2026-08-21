"""Аналитика заказов кафе/ресторана."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Avg, Count
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import ProviderStaff
from users.models import User

from .models import CafeOrder, CafeOrderItemRating


def _is_cafe_provider(user) -> bool:
    return (
        user
        and user.is_authenticated
        and user.role == User.Role.PROVIDER
        and user.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT
    )


def _provider_for_user(user):
    if user.role == User.Role.PROVIDER and _is_cafe_provider(user):
        return user
    if user.role == User.Role.STAFF:
        link = (
            ProviderStaff.objects.filter(
                staff=user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            )
            .select_related("provider")
            .first()
        )
        if link and _is_cafe_provider(link.provider):
            return link.provider
    return None


REVENUE_STATUSES = {
    CafeOrder.Status.PAID,
    CafeOrder.Status.ACCEPTED,
    CafeOrder.Status.COOKING,
    CafeOrder.Status.READY,
    CafeOrder.Status.DELIVERING,
    CafeOrder.Status.DONE,
}


class CafeAnalyticsSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider = _provider_for_user(request.user)
        if not provider:
            return Response({"detail": "Кафе не найдено."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        date_from = parse_date(request.query_params.get("from") or "") or (today - timedelta(days=30))
        date_to = parse_date(request.query_params.get("to") or "") or today
        if date_from > date_to:
            date_from, date_to = date_to, date_from

        start_dt = timezone.make_aware(datetime.combine(date_from, datetime.min.time()))
        end_dt = timezone.make_aware(datetime.combine(date_to, datetime.max.time()))

        orders = (
            CafeOrder.objects.filter(provider=provider, created_at__gte=start_dt, created_at__lte=end_dt)
            .exclude(status=CafeOrder.Status.DRAFT)
            .select_related("table")
            .prefetch_related("items")
            .order_by("-created_at")
        )

        by_status = {s: 0 for s, _ in CafeOrder.Status.choices if s != CafeOrder.Status.DRAFT}
        by_mode = {m: {"count": 0, "revenue": Decimal("0")} for m, _ in CafeOrder.Mode.choices}
        by_day = defaultdict(lambda: {"count": 0, "done": 0, "revenue": Decimal("0")})
        by_item = defaultdict(lambda: {"id": None, "name": "", "count": 0, "revenue": Decimal("0")})
        revenue = Decimal("0")
        revenue_orders = 0
        rows = []

        for o in orders:
            by_status[o.status] = by_status.get(o.status, 0) + 1
            day = timezone.localtime(o.created_at).date().isoformat()
            by_day[day]["count"] += 1
            total = Decimal(str(o.total or 0))
            if o.status in REVENUE_STATUSES:
                revenue += total
                revenue_orders += 1
                by_day[day]["revenue"] += total
                by_mode[o.mode]["revenue"] += total
            if o.status == CafeOrder.Status.DONE:
                by_day[day]["done"] += 1
            by_mode[o.mode]["count"] += 1

            for line in o.items.all():
                key = line.menu_item_id or f"n:{line.name}"
                by_item[key]["id"] = line.menu_item_id
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
                    "table_label": o.table.label if o.table_id else "",
                    "pay_method": o.pay_method,
                }
            )

        ratings = CafeOrderItemRating.objects.filter(
            order__provider=provider,
            created_at__gte=start_dt,
            created_at__lte=end_dt,
        )
        rev_agg = ratings.aggregate(avg=Avg("rating"), cnt=Count("id"))
        rating_hist = {i: 0 for i in range(1, 6)}
        for r in ratings.values("rating").annotate(c=Count("id")):
            rating_hist[int(r["rating"])] = r["c"]

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
                "kind": "cafe",
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "totals": {
                    "orders": len(rows),
                    "by_status": by_status,
                    "by_mode": {k: v["count"] for k, v in by_mode.items()},
                    "revenue_estimate": float(revenue),
                    "average_check": round(avg_check, 2),
                    "ratings_count": rev_agg["cnt"] or 0,
                    "average_rating": round(float(rev_agg["avg"] or 0), 2),
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
                "rating_histogram": rating_hist,
                "orders": rows,
            }
        )
