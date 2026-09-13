"""HTTP: staff permissions + service assignment PATCH."""

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from catalog.models import Service, ServiceCategory
from users.models import User

from booking.models import ProviderStaff, default_staff_permissions
from subscriptions.models import SubscriptionPlan, UserSubscription


class StaffPermissionsApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-staff-perms",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Perms",
        )
        self.staff = User.objects.create_user(
            username="staff-perms",
            password="x",
            role=User.Role.STAFF,
        )
        self.link = ProviderStaff.objects.create(
            provider=self.provider,
            staff=self.staff,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            is_active=True,
            job_title="Мастер",
            permissions=default_staff_permissions(),
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
        self.category = ServiceCategory.objects.create(
            provider=self.provider,
            name="Стрижки",
        )
        self.service = Service.objects.create(
            provider=self.provider,
            category=self.category,
            name="Стрижка",
            price=Decimal("1000"),
            duration_minutes=30,
            is_active=True,
        )
        self.api.force_authenticate(self.provider)

    def test_patch_permissions(self):
        perms = default_staff_permissions()
        perms["manage_intervals"] = True
        perms["manage_staff"] = True
        res = self.api.patch(
            f"/api/booking/staff/{self.link.id}/",
            {"permissions": perms},
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data["permissions"]["manage_intervals"])
        self.assertTrue(res.data["permissions"]["manage_staff"])
        self.link.refresh_from_db()
        self.assertTrue(self.link.permissions.get("manage_intervals"))

    def test_assign_services(self):
        res = self.api.patch(
            f"/api/booking/staff/{self.link.id}/",
            {
                "assigned_service_ids": [self.service.id],
                "assigned_category_ids": [self.category.id],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data.get("assigned_service_ids"), [self.service.id])
        self.assertEqual(res.data.get("assigned_category_ids"), [self.category.id])
        self.link.refresh_from_db()
        self.assertTrue(self.link.assigned_services.filter(pk=self.service.id).exists())
        self.assertTrue(self.link.assigned_categories.filter(pk=self.category.id).exists())
