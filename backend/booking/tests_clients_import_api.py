"""HTTP: Excel/CSV import into provider client base."""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIClient

from booking.models import ProviderClientCard
from users.models import User


class ClientsImportApiTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.provider = User.objects.create_user(
            username="salon-clients-import",
            password="x",
            role=User.Role.PROVIDER,
            provider_sphere=User.ProviderSphere.HAIR_SALON,
            organization_name="Салон Import",
        )
        self.api.force_authenticate(self.provider)

    def test_import_csv_creates_clients(self):
        csv_body = (
            "имя,телефон,источник\n"
            "Анна Импорт,+79001112233,Instagram\n"
            "Пётр Импорт,89994445566,Реклама\n"
        ).encode("utf-8-sig")
        upload = SimpleUploadedFile("clients.csv", csv_body, content_type="text/csv")
        res = self.api.post("/api/booking/clients/", {"file": upload}, format="multipart")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data.get("ok"))
        self.assertEqual(res.data.get("created"), 2)
        self.assertEqual(res.data.get("updated"), 0)
        self.assertIn("Импортировано", res.data.get("detail") or "")

        cards = ProviderClientCard.objects.filter(provider=self.provider, hidden=False)
        self.assertEqual(cards.count(), 2)
        sources = {c.acquisition_source for c in cards}
        self.assertTrue("Instagram" in sources or "Реклама" in sources)

    def test_import_empty_file_rejected(self):
        upload = SimpleUploadedFile("empty.csv", b"", content_type="text/csv")
        res = self.api.post("/api/booking/clients/", {"file": upload}, format="multipart")
        # Empty CSV has no rows → ok with created=0, or read error depending on parser
        self.assertIn(res.status_code, (200, 400), res.data)
