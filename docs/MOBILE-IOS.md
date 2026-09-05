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

## Push (APNs)

Позже: включить Push Notifications capability в Xcode, загрузить APNs key в Firebase, тот же `@capacitor/push-notifications` что на Android.

---

## Связанные файлы

- `frontend/ios/App/App/App.entitlements` — Associated Domains
- `frontend/ios/App/App/Info.plist` — URL scheme `vmeste`
- `frontend/public/.well-known/apple-app-site-association`
- `docs/MOBILE-ANDROID.md` — App Links / assetlinks
