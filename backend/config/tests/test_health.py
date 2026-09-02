from django.test import TestCase


class HealthEndpointTests(TestCase):
    def test_health_returns_db_ok(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn(data["status"], ("ok", "degraded"))
        self.assertTrue(data["checks"]["db"])
        self.assertIn("speechkit", data["checks"])
        self.assertIn("asterisk_ami", data["checks"])
