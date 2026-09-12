# Testing

How to run booking/cafe/shop/marketplace test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook cafe.tests_guest_order_pay shop.tests_public_order_pay marketplaces.tests marketplaces.tests_sync marketplaces.tests_e2e_sandbox --verbosity=2
```

Local SQLite:

```bash
set DJANGO_SETTINGS_MODULE=config.settings_test
python manage.py test …  # same modules
```

| Module | Covers |
|--------|--------|
| `booking.tests_client_book_api` | Client book / pay / loyalty / package / return_url |
| `subscriptions.tests_yookassa_webhook` | Webhook routing booking / cafe / shop / subscription |
| `cafe.tests_guest_order_pay` | Guest order online/cash, tip+service, payment failure |
| `shop.tests_public_order_pay` | Public order online/cash, instant success, cancel on fail |
| `marketplaces.tests` | Helpers, webhook Bearer/JSON secret, sync enqueue |
| `marketplaces.tests_sync` | Ozon pending→success/fail, max attempts |
| `marketplaces.tests_e2e_sandbox` | Sandbox import, order poll notify delta |

## Frontend unit (Vitest)

```bash
cd Vmeste/frontend && npm test
```

- `bookingDisplay.test.js` — `estimateClientBookCharge`
- `cafeCheckoutMath.test.js` — `estimateCafeGuestCharge`

## Frontend E2E (Playwright)

```bash
npx playwright install chromium
npm run test:e2e
```

| Spec | Scenarios |
|------|-----------|
| `android.spec.js` | APK CTA |
| `client-book.spec.js` | map → book → free/prepay → payment return |
| `cafe-guest.spec.js` | `/m` online + cash + `?order=` paid |
| `shop-public.spec.js` | `/s` online + cash + `?order=` paid |

## CI

| Job | What |
|-----|------|
| `backend-tests` | Django suite incl. book/cafe/shop/MP |
| `frontend-build` | `npm test` + build |
| `frontend-e2e` | Playwright Chromium |
