# Testing

How to run booking/cafe/shop/marketplace/subscription test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
python manage.py test booking.tests_client_book_api booking.tests_cancel_client_api booking.tests_org_booking_actions_api subscriptions.tests_yookassa_webhook subscriptions.tests_subscribe_pay subscriptions.tests_cancel_promo_api cafe.tests_guest_order_pay shop.tests_public_order_pay marketplaces.tests marketplaces.tests_sync marketplaces.tests_e2e_sandbox --verbosity=2
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
| `client-book.spec.js` | map → book → package / loyalty / pay resume / pay return |
| `client-cancel.spec.js` | Моё → Все записи → cancel-by-client |
| `client-waitlist.spec.js` | empty slots → join waitlist |
| `provider-waitlist.spec.js` | Записи → Снять waitlist |
| `provider-bookings.spec.js` | confirm / no-show / arrived / mark-done / cancel-by-org / confirm_message_not_set |
| `cafe-guest.spec.js` | online / cash / delivery cash / zone map pick + fee / `?order=` |
| `shop-public.spec.js` | online / cash / delivery cash / `?order=` |
| `subscription-return.spec.js` | `?payment=success` → Подписки + confirm |
| `subscription-pay.spec.js` | Оплатить → promo skip → pay redirect |
| `subscription-promo.spec.js` | Оплатить → apply VSEVMESTE |
| `subscription-cancel.spec.js` | Отключить подписку → cancel API |

Backend also covers create booking → waitlist `BOOKED`, client cancel → package restore + waitlist notify, org confirm/no-show/arrived/done/cancel-by-org HTTP, shop delivery zones (in/out/missing point), subscription promo/cancel.

## CI

`backend-tests` · `frontend-build` (`npm test`) · `frontend-e2e`
