# Testing

How to run booking/cafe/shop/marketplace/subscription test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook subscriptions.tests_subscribe_pay cafe.tests_guest_order_pay shop.tests_public_order_pay marketplaces.tests marketplaces.tests_sync marketplaces.tests_e2e_sandbox --verbosity=2
```

Local SQLite: `set DJANGO_SETTINGS_MODULE=config.settings_test`

| Module | Covers |
|--------|--------|
| `booking.tests_client_book_api` | Client book / pay / loyalty / package |
| `subscriptions.tests_yookassa_webhook` | Webhook routing |
| `subscriptions.tests_subscribe_pay` | Pay / confirm / renew (mock YooKassa) |
| `cafe.tests_guest_order_pay` | Guest order online/cash |
| `shop.tests_public_order_pay` | Public order online/cash |
| `marketplaces.tests*` | Webhook Bearer, sync, poll delta |

## Frontend unit (Vitest)

```bash
cd Vmeste/frontend && npm test
```

- `bookingDisplay.test.js` — book charge
- `cafeCheckoutMath.test.js` — tip/service/delivery totals
- `cafeDeliveryZones.test.js` — `findZoneAt`

## Frontend E2E (Playwright)

```bash
npx playwright install chromium && npm run test:e2e
```

| Spec | Scenarios |
|------|-----------|
| `android.spec.js` | APK CTA |
| `client-book.spec.js` | map → book → pay return |
| `cafe-guest.spec.js` | online / cash / delivery cash / `?order=` |
| `shop-public.spec.js` | online / cash / `?order=` |

## CI

`backend-tests` · `frontend-build` (`npm test`) · `frontend-e2e`
