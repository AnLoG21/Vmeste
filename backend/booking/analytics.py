from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal

from django.db.models import Avg, Count
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import Booking, ProviderStaff
from reviews.models import Review
from users.models import User


def _provider_for_user(user):
    if user.role == User.Role.PROVIDER:
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
        return link.provider if link else None
    return None


class AnalyticsSummaryView(APIView):
    """Aggregated dashboards for provider/staff: bookings, revenue estimate, ratings."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider = _provider_for_user(request.user)
        if not provider:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_400_BAD_REQUEST)

        today = timezone.localdate()
        date_from = parse_date(request.query_params.get("from") or "") or (today - timedelta(days=30))
        date_to = parse_date(request.query_params.get("to") or "") or today
        if date_from > date_to:
            date_from, date_to = date_to, date_from

        start_dt = timezone.make_aware(datetime.combine(date_from, datetime.min.time()))
        end_dt = timezone.make_aware(datetime.combine(date_to, datetime.max.time()))

        bookings = (
            Booking.objects.filter(provider=provider, created_at__gte=start_dt, created_at__lte=end_dt)
            .select_related("service", "staff", "client", "slot")
            .order_by("-created_at")
        )

        by_status = {s: 0 for s, _ in Booking.Status.choices}
        revenue = Decimal("0")
        by_day = defaultdict(lambda: {"count": 0, "done": 0, "revenue": Decimal("0")})
        by_service = defaultdict(lambda: {"id": None, "name": "", "count": 0, "revenue": Decimal("0")})
        by_staff = defaultdict(lambda: {"id": None, "name": "", "count": 0, "done": 0})

        rows = []
        for b in bookings:
            by_status[b.status] = by_status.get(b.status, 0) + 1
            day = timezone.localtime(b.created_at).date().isoformat()
            by_day[day]["count"] += 1
            price = Decimal(str(b.service.price)) if b.service_id else Decimal("0")
            if b.status == Booking.Status.DONE:
                revenue += price
                by_day[day]["done"] += 1
                by_day[day]["revenue"] += price
            if b.service_id:
                key = b.service_id
                by_service[key]["id"] = b.service_id
                by_service[key]["name"] = b.service.name
                by_service[key]["count"] += 1
                if b.status == Booking.Status.DONE:
                    by_service[key]["revenue"] += price
            staff_key = b.staff_id or 0
            staff_name = "Без мастера"
            if b.staff_id and b.staff:
                u = b.staff
                staff_name = " ".join(
                    filter(None, [getattr(u, "last_name", ""), getattr(u, "first_name", "")])
                ).strip() or getattr(u, "username", f"#{b.staff_id}")
            by_staff[staff_key]["id"] = b.staff_id
            by_staff[staff_key]["name"] = staff_name
            by_staff[staff_key]["count"] += 1
            if b.status == Booking.Status.DONE:
                by_staff[staff_key]["done"] += 1

            client_name = ""
            if b.client_id:
                c = b.client
                client_name = " ".join(
                    filter(None, [getattr(c, "last_name", ""), getattr(c, "first_name", "")])
                ).strip() or c.username
            rows.append(
                {
                    "id": b.id,
                    "created_at": b.created_at.isoformat(),
                    "status": b.status,
                    "service": b.service.name if b.service_id else "",
                    "service_id": b.service_id,
                    "price": float(price),
                    "staff": staff_name,
                    "staff_id": b.staff_id,
                    "client": client_name,
                    "slot_starts_at": b.slot.starts_at.isoformat() if b.slot_id else None,
                }
            )

        reviews = Review.objects.filter(
            provider=provider, created_at__gte=start_dt, created_at__lte=end_dt
        )
        rev_agg = reviews.aggregate(avg=Avg("rating"), cnt=Count("id"))
        rating_hist = {i: 0 for i in range(1, 6)}
        for r in reviews.values("rating").annotate(c=Count("id")):
            rating_hist[int(r["rating"])] = r["c"]

        days = []
        cur = date_from
        while cur <= date_to:
            key = cur.isoformat()
            cell = by_day[key]
            days.append(
                {
                    "date": key,
                    "bookings": cell["count"],
                    "done": cell["done"],
                    "revenue": float(cell["revenue"]),
                }
            )
            cur += timedelta(days=1)

        return Response(
            {
                "from": date_from.isoformat(),
                "to": date_to.isoformat(),
                "totals": {
                    "bookings": len(rows),
                    "by_status": by_status,
                    "revenue_estimate": float(revenue),
                    "reviews_count": rev_agg["cnt"] or 0,
                    "average_rating": round(float(rev_agg["avg"] or 0), 2),
                },
                "by_day": days,
                "by_service": sorted(
                    (
                        {
                            "id": v["id"],
                            "name": v["name"],
                            "count": v["count"],
                            "revenue": float(v["revenue"]),
                        }
                        for v in by_service.values()
                    ),
                    key=lambda x: -x["count"],
                ),
                "by_staff": sorted(
                    (
                        {
                            "id": v["id"],
                            "name": v["name"],
                            "count": v["count"],
                            "done": v["done"],
                        }
                        for v in by_staff.values()
                    ),
                    key=lambda x: -x["count"],
                ),
                "rating_histogram": rating_hist,
                "bookings": rows,
            }
        )
