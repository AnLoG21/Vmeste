# Testing

How to run the booking/payments and cafe/shop checkout test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
# Prefer Postgres like CI (see .github/workflows/ci.yml env).
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook cafe.tests_guest_order_pay shop.tests_public_order_pay --verbosity=2
```

Local SQLite shortcut (no Postgres):

```bash
set DJANGO_SETTINGS_MODULE=config.settings_test
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook cafe.tests_guest_order_pay shop.tests_public_order_pay --verbosity=2
```

| Module | Covers |
|--------|--------|
| `booking.tests_client_book_api` | Client `POST /api/booking/`, loyalty/package, `.../pay/`, `return_url` |
| `subscriptions.tests_yookassa_webhook` | Webhook routing booking / cafe / shop / subscription / fallback |
| `cafe.tests_guest_order_pay` | Guest order online/cash, tip+service amount, payment create failure |
| `shop.tests_public_order_pay` | Public order online/cash, instant succeeded, payment failure → cancel |

## Frontend unit (Vitest)

From `Vmeste/frontend`:

```bash
npm test
# watch:
npm run test:watch
```

- `bookingDisplay.test.js` — `estimateClientBookCharge`
- `cafeCheckoutMath.test.js` — `estimateCafeGuestCharge` (tip / service / delivery)

## Frontend E2E (Playwright)

Chromium, mobile viewport (Pixel 7). API is mocked via `page.route` — no Django required.

```bash
npx playwright install chromium
npm run test:e2e
```

Specs in `e2e/`:

1. `/android` — APK CTA  
2. Map org sheet → «Записаться»  
3. Free book → «Моё», modal closed  
4. Prepay → modal closed before YooKassa redirect  
5. `/activity?booking_payment=success` → «Моё»

Config: `playwright.config.js` (builds + Vite preview on `:4173`).

## CI

| Job | What |
|-----|------|
| `backend-tests` | Django modules including book API, cafe/shop pay, YooKassa webhook |
| `frontend-build` | `npm test` then production build |
| `frontend-e2e` | Playwright Chromium after frontend-build |
