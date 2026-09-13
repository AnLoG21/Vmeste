# Testing

How to run booking/cafe/shop/marketplace/subscription test layers locally and what CI covers.

## Backend (Django API)

From `Vmeste/backend`:

```bash
set DJANGO_SETTINGS_MODULE=config.settings_test
python manage.py test booking.tests_client_book_api booking.tests_cancel_client_api booking.tests_org_booking_actions_api subscriptions.tests_yookassa_webhook subscriptions.tests_subscribe_pay subscriptions.tests_cancel_promo_api cafe.tests_guest_order_pay shop.tests_public_order_pay marketplaces.tests marketplaces.tests_sync marketplaces.tests_e2e_sandbox users.test_email_demo moy_nalog.tests --verbosity=2
```

### Coverage

```bash
set DJANGO_SETTINGS_MODULE=config.settings_test
coverage run manage.py test …   # same modules as CI
coverage report
coverage html   # optional: htmlcov/
```

CI runs `coverage run` + `coverage report` and uploads `coverage.xml`.

## Frontend unit (Vitest)

```bash
cd Vmeste/frontend && npm test
npm run test:coverage
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
| `client-review.spec.js` | Моё → Все записи → Отзыв → POST /reviews/ |
| `client-loyalty.spec.js` | /loyalty → org → buy package → POST purchase |
| `client-activity.spec.js` | /activity → booking+loyalty tabs → Все записи |
| `client-chats.spec.js` | /chats → org chat → open thread |
| `client-chats-send.spec.js` | /chats → send text → POST /messages/ |
| `client-chats-mark-read.spec.js` | /chats → open thread → POST mark-read |
| `client-notifications.spec.js` | /cabinet → Понятно → mark-read |
| `client-telegram-link.spec.js` | /settings → telegram link GET |
| `client-telegram-unlink.spec.js` | /settings → Отвязать → DELETE |
| `client-notify-prefs.spec.js` | /settings → save notify prefs PATCH |
| `client-change-password.spec.js` | /settings → Сменить пароль → POST |
| `client-staff-invite.spec.js` | /cabinet → accept staff invite |
| `provider-acquiring.spec.js` | /organization → save prepay acquiring |
| `provider-chats.spec.js` | /chats → Избранное |
| `provider-loyalty.spec.js` | /service-catalog → save loyalty PATCH |
| `provider-create-package.spec.js` | /service-catalog → Создать абонемент → POST |
| `provider-sell-package.spec.js` | /service-catalog → Выдать → POST client-packages |
| `provider-messaging.spec.js` | /organization → enable Telegram → PATCH messaging |
| `provider-booking-messages.spec.js` | /organization → save booking message templates |
| `provider-calendar.spec.js` | /organization → rotate calendar ICS link |
| `provider-moy-nalog.spec.js` | /organization → toggle MoyNalog auto receipt |
| `inspection-public.spec.js` | `/i/:token` → Утвердить ремонт → POST approve |
| `client-waitlist.spec.js` | empty slots → join waitlist |
| `provider-waitlist.spec.js` | Записи → Снять waitlist |
| `provider-bookings.spec.js` | confirm / no-show / arrived / mark-done / cancel-by-org / message + prepay + not-started modals |
| `cafe-guest.spec.js` | online / cash / delivery cash / zone map pick + fee / outside zone / `?order=` |
| `shop-public.spec.js` | online / cash / delivery cash / zone map pick / outside zone / `?order=` |
| `subscription-return.spec.js` | `?payment=success` → Подписки + confirm |
| `subscription-pay.spec.js` | Оплатить → promo skip → pay redirect |
| `subscription-promo.spec.js` | Оплатить → apply VSEVMESTE |
| `subscription-cancel.spec.js` | Отключить подписку → cancel API |

Backend also covers create booking → waitlist `BOOKED`, client cancel → package restore + waitlist notify, org confirm/no-show/arrived/done/cancel-by-org HTTP, cafe/shop delivery zones (in/out/missing point), subscription promo/cancel, demo mailbox SMTP skip, MoyNalog helpers + status/enable/disconnect API, client reviews API, inspection public approve, loyalty me/accounts + package purchase, loyalty settings + sell package, chat conversations + activity + mark-read, in-app mark-read + push register, telegram link token, client notify prefs, org messaging settings + org telegram link, calendar ICS rotate, booking message templates, acquiring settings, staff invite accept/reject, change-password email flow.

## CI

`backend-tests` (coverage) · `frontend-build` (`npm run test:coverage`) · `frontend-e2e`
