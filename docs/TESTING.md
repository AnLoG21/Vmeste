# Testing

How to run the booking/payments test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
# Prefer Postgres like CI (see .github/workflows/ci.yml env).
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook --verbosity=2

# Full CI-aligned suite (subset listed in ci.yml):
python manage.py test config.tests.test_health booking.tests_loyalty_pay booking.tests_client_book_api subscriptions.tests_yookassa_webhook --verbosity=2
```

Local SQLite shortcut (no Postgres):

```bash
set DJANGO_SETTINGS_MODULE=config.settings_test
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook --verbosity=2
```

`tests_client_book_api` covers client `POST /api/booking/`, loyalty/package paths, `.../pay/`, and `return_url` with `/activity?booking_payment=success`.  
`tests_yookassa_webhook` covers payment routing for booking / cafe / shop / subscription / fallback / unknown id.

## Frontend unit (Vitest)

From `Vmeste/frontend`:

```bash
npm test
# watch:
npm run test:watch
```

Covers `estimateClientBookCharge` in `src/bookingDisplay.test.js` (loyalty, percent prepay, package, zero price).

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
5. `/?booking_payment=success` / `/activity?...` → «Моё»

Config: `playwright.config.js` (builds + Vite preview on `:4173`).

## CI

| Job | What |
|-----|------|
| `backend-tests` | Django modules including client book API + YooKassa webhook |
| `frontend-build` | `npm test` then production build |
| `frontend-e2e` | Playwright Chromium after frontend-build |
