"""HTTP: staff invite accept/reject (client invitee)."""

from django.test import TestCase
from rest_framework.test import APIClient

from users.models import User

from booking.models import ProviderStaff
from notifications.models import InAppNotification


class StaffInviteApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-invite-api",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Invite",
        )
        self.invitee = User.objects.create_user(
            username="client-invite-api",
            password="x",
            role=User.Role.CLIENT,
        )
        self.link = ProviderStaff.objects.create(
            provider=self.provider,
            staff=self.invitee,
            invitation_status=ProviderStaff.InvitationStatus.PENDING,
            is_active=False,
        )
        self.api.force_authenticate(self.invitee)

    def test_accept_invite_promotes_to_staff(self):
        res = self.api.post(f"/api/booking/staff/{self.link.id}/accept-invite/", {}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.link.refresh_from_db()
        self.assertEqual(self.link.invitation_status, ProviderStaff.InvitationStatus.ACCEPTED)
        self.assertTrue(self.link.is_active)
        self.invitee.refresh_from_db()
        self.assertEqual(self.invitee.role, User.Role.STAFF)
        self.assertTrue(
            InAppNotification.objects.filter(
                user=self.provider,
                kind=InAppNotification.Kind.STAFF_INVITE_ACCEPTED,
            ).exists()
        )

    def test_reject_invite_deletes_link(self):
        res = self.api.post(f"/api/booking/staff/{self.link.id}/reject-invite/", {}, format="json")
        self.assertEqual(res.status_code, 204)
        self.assertFalse(ProviderStaff.objects.filter(pk=self.link.id).exists())

    def test_accept_rejects_when_not_pending(self):
        self.link.invitation_status = ProviderStaff.InvitationStatus.ACCEPTED
        self.link.is_active = True
        self.link.save(update_fields=["invitation_status", "is_active"])
        res = self.api.post(f"/api/booking/staff/{self.link.id}/accept-invite/", {}, format="json")
        self.assertEqual(res.status_code, 400, res.data)
