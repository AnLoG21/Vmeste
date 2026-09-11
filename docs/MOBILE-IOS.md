# iOS-приложение Vmeste (Capacitor)

Тот же React-фронтенд в WKWebView. Проект: `frontend/ios/` (Xcode). Сборка только на **macOS**.

---

## Требования

1. **Mac** + **Xcode 15+**
2. Apple Developer Program ($99/год) — Team ID для Universal Links
3. Node.js 20+ (как для Android)

---

## Первый запуск на Mac

```bash
cd frontend
npm install
npm run build:mobile
npx cap sync ios
npx cap open ios
```

В Xcode:

1. Signing & Capabilities → выбрать Team
2. Bundle ID уже `space.vsevmeste.app`
3. Associated Domains уже в `App.entitlements` (`applinks:vsevmeste.space`)
4. Run на симуляторе или устройстве

---

## Universal Links + custom scheme

| Тип | Пример |
|-----|--------|
| HTTPS (Universal Link) | `https://vsevmeste.space/cabinet` |
| Custom | `vmeste://app/cabinet` |

Сайт отдаёт `/.well-known/apple-app-site-association` (см. ниже).  
JS слушает `@capacitor/app` `appUrlOpen` + событие `vmesteDeepLink`.

### Заменить TEAMID

В `frontend/public/.well-known/apple-app-site-association` строка:

```text
TEAMID.space.vsevmeste.app
```

`TEAMID` → ваш **Team ID** из [developer.apple.com/account](https://developer.apple.com/account) (Membership details), 10 символов.  
После правки — деплой фронта (как обычно через `main`).

Проверка после деплоя:

```bash
curl -sI https://vsevmeste.space/.well-known/apple-app-site-association
# Content-Type: application/json, HTTP 200, без редиректа
```

Apple CDN кэширует AASA; после смены Team ID может пройти несколько часов.

---

## Скрипты npm

| Команда | Назначение |
|---------|------------|
| `npm run cap:sync:ios` | `build:mobile` + `cap sync ios` |
| `npm run cap:open:ios` | открыть Xcode |

---

## Push (APNs → FCM)

Тот же JS (`frontend/src/pushNotifications.js`) и backend FCM HTTP v1, что на Android.
На iOS Capacitor отдаёт **FCM-токен** только если в приложение вшит **Firebase Messaging** (иначе придёт сырой APNs-токен — сервер его не примет).

Код в репо уже готов:

- `App.entitlements` — `aps-environment` + Associated Domains
- `Info.plist` — `UIBackgroundModes` → `remote-notification`
- `AppDelegate.swift` — `FirebaseApp.configure()` + обмен APNs→FCM (под `#if canImport(Firebase…)`)
- `backend/notifications/push.py` — блок `apns` в payload

Остаётся сделать **один раз на Mac** в Apple / Firebase / Xcode.

### 1. Apple Developer

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) → App ID `space.vsevmeste.app` → включить **Push Notifications**
2. Keys → создать **Apple Push Notifications service (APNs)** key (`.p8`), сохранить Key ID + Team ID + файл

### 2. Firebase iOS-приложение

1. [Firebase Console](https://console.firebase.google.com/) → проект **vmeste-32513**
2. Add app → **iOS** → Bundle ID `space.vsevmeste.app`
3. Скачать **`GoogleService-Info.plist`** → положить в  
   `frontend/ios/App/App/GoogleService-Info.plist`  
   (шаблон: `GoogleService-Info.plist.example`)
4. Project settings → Cloud Messaging → **APNs Authentication Key** → загрузить `.p8` (Key ID + Team ID)

Серверный `service-account.json` тот же, что для Android (`docs/MOBILE-ANDROID.md`).

### 3. Xcode

```bash
cd frontend
npm run cap:sync:ios
npx cap open ios
```

1. Signing & Capabilities → **+ Capability** → **Push Notifications**  
   (для Archive/TestFlight Xcode выставит `aps-environment` = `production`)
2. File → Add Package Dependencies →  
   `https://github.com/firebase/firebase-ios-sdk`  
   → добавить продукты **FirebaseCore** и **FirebaseMessaging** к target **App**
3. Добавить `GoogleService-Info.plist` в target App (Copy Bundle Resources), если Xcode не подхватил файл сам
4. Run на **реальном устройстве** (симулятор push ограничен) → разрешить уведомления → войти в аккаунт

Проверка: в Django admin / БД `DevicePushToken` с `platform=ios` после логина.

---

## Связанные файлы

- `frontend/ios/App/App/App.entitlements` — Associated Domains + Push
- `frontend/ios/App/App/Info.plist` — URL scheme `vmeste`, background remote-notification
- `frontend/ios/App/App/AppDelegate.swift` — Firebase / FCM token bridge
- `frontend/ios/App/App/GoogleService-Info.plist.example`
- `frontend/public/.well-known/apple-app-site-association`
- `docs/MOBILE-ANDROID.md` — FCM service account / App Links
