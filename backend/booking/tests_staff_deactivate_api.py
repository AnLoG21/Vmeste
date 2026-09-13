"""HTTP: provider deactivates staff link via PATCH."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from booking.models import ProviderStaff
from subscriptions.models import SubscriptionPlan, UserSubscription


class StaffDeactivateApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-staff-deact",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Deact",
        )
        self.staff = User.objects.create_user(
            username="staff-deact",
            password="x",
            role=User.Role.STAFF,
        )
        self.link = ProviderStaff.objects.create(
            provider=self.provider,
            staff=self.staff,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            is_active=True,
            job_title="Мастер",
        )
        business, _ = SubscriptionPlan.objects.get_or_create(
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
        SubscriptionPlan.objects.filter(pk=business.pk).update(
            plan_type=SubscriptionPlan.PlanType.PAID,
            product_kind=SubscriptionPlan.ProductKind.PLATFORM,
            is_active=True,
        )
        UserSubscription.objects.create(
            user=self.provider,
            plan=business,
            status=UserSubscription.Status.ACTIVE,
            source=UserSubscription.Source.PAID,
        )
        self.api.force_authenticate(self.provider)

    def test_deactivate_staff(self):
        res = self.api.patch(
            f"/api/booking/staff/{self.link.id}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertFalse(res.data.get("is_active"))
        self.link.refresh_from_db()
        self.assertFalse(self.link.is_active)

    def test_patch_job_title(self):
        res = self.api.patch(
            f"/api/booking/staff/{self.link.id}/",
            {"job_title": "Администратор"},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.link.refresh_from_db()
        self.assertEqual(self.link.job_title, "Администратор")
