"""HTTP: provider creates staff invite (Business plan gate)."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from booking.models import ProviderStaff
from subscriptions.models import SubscriptionPlan, UserSubscription


class StaffInviteCreateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-invite-create",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Create Invite",
        )
        self.invitee = User.objects.create_user(
            username="client-to-invite",
            password="x",
            role=User.Role.CLIENT,
            email="invitee@example.com",
        )
        self.business, _ = SubscriptionPlan.objects.get_or_create(
            slug="business",
            defaults={
                "name": "Бизнес",
                "description": "Paid",
                "price_monthly": Decimal("1990"),
                "plan_type": SubscriptionPlan.PlanType.PAID,
                "product_kind": SubscriptionPlan.ProductKind.PLATFORM,
                "features": ["Сотрудники"],
                "is_active": True,
                "sort_order": 2,
            },
        )
        SubscriptionPlan.objects.filter(pk=self.business.pk).update(
            plan_type=SubscriptionPlan.PlanType.PAID,
            product_kind=SubscriptionPlan.ProductKind.PLATFORM,
            is_active=True,
        )
        self.business.refresh_from_db()
        self.api.force_authenticate(self.provider)

    def _activate_business(self):
        UserSubscription.objects.create(
            user=self.provider,
            plan=self.business,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
        )

    def test_create_invite_happy(self):
        self._activate_business()
        res = self.api.post(
            "/api/booking/staff/",
            {"invite_identifier": self.invitee.username, "job_title": "Администратор"},
            format="json",
        )
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data.get("invitation_status"), ProviderStaff.InvitationStatus.PENDING)
        self.assertFalse(res.data.get("is_active"))
        link = ProviderStaff.objects.get(provider=self.provider, staff=self.invitee)
        self.assertEqual(link.job_title, "Администратор")
        self.assertEqual(link.invitation_status, ProviderStaff.InvitationStatus.PENDING)

    def test_create_blocked_without_business(self):
        res = self.api.post(
            "/api/booking/staff/",
            {"invite_identifier": self.invitee.username},
            format="json",
        )
        self.assertEqual(res.status_code, 403, res.data)
        self.assertIn("Бизнес", (res.data.get("detail") or ""))

    def test_create_unknown_user(self):
        self._activate_business()
        res = self.api.post(
            "/api/booking/staff/",
            {"invite_identifier": "no-such-user-xyz"},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)

    def test_create_duplicate_pending(self):
        self._activate_business()
        ProviderStaff.objects.create(
            provider=self.provider,
            staff=self.invitee,
            invitation_status=ProviderStaff.InvitationStatus.PENDING,
            is_active=False,
        )
        res = self.api.post(
            "/api/booking/staff/",
            {"invite_identifier": self.invitee.username},
            format="json",
        )
        self.assertEqual(res.status_code, 400, res.data)
        self.assertIn("уже", (res.data.get("detail") or "").lower())
