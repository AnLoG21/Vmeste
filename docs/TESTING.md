# Testing

How to run booking/cafe/shop/marketplace/subscription test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
python manage.py test booking.tests_client_book_api subscriptions.tests_yookassa_webhook subscriptions.tests_subscribe_pay cafe.tests_guest_order_pay shop.tests_public_order_pay marketplaces.tests marketplaces.tests_sync marketplaces.tests_e2e_sandbox --verbosity=2
```

Local SQLite: `set DJANGO_SETTINGS_MODULE=config.settings_test`

## Frontend unit (Vitest)

```bash
cd Vmeste/frontend && npm test
```

`bookingDisplay` · `cafeCheckoutMath` · `cafeDeliveryZones` (`findZoneAt`)

## Frontend E2E (Playwright)

```bash
npx playwright install chromium && npm run test:e2e
```

| Spec | Scenarios |
|------|-----------|
| `android.spec.js` | APK CTA |
| `client-book.spec.js` | map → book → pay return |
| `client-waitlist.spec.js` | empty slots → join waitlist |
| `cafe-guest.spec.js` | online / cash / delivery cash / `?order=` |
| `shop-public.spec.js` | online / cash / delivery cash / `?order=` |
| `subscription-return.spec.js` | `?payment=success` → Подписки + confirm |
| `subscription-pay.spec.js` | Оплатить → promo skip → pay redirect |

Backend `booking.tests_client_book_api` also covers create booking → waitlist `BOOKED`.

## CI

`backend-tests` · `frontend-build` (`npm test`) · `frontend-e2e`
