# Android-приложение Vmeste (Capacitor)

Мобильное приложение — это тот же React-фронтенд в WebView, API на `https://vsevmeste.space/api`.

---

## Что нужно на ПК (Windows)

1. **Node.js 20+** — уже есть для фронтенда
2. **Android Studio** — [developer.android.com/studio](https://developer.android.com/studio)
   - При установке отметьте **Android SDK**, **Android SDK Platform**, **Android Virtual Device**
3. **JDK 17** — обычно идёт с Android Studio

После установки Android Studio откройте **SDK Manager** и установите **Android 14 (API 34)** или новее.

---

## Переменные окружения

Файл `frontend/.env.mobile`:

```env
VITE_API_URL=https://vsevmeste.space/api
```

Сборка мобильной версии использует `--mode mobile` и этот URL.

---

## Сборка и запуск (первый раз)

```powershell
cd C:\Users\analo\projects\vmeste\Vmeste\frontend

npm install

npm run build:mobile
npx cap add android
npm run cap:sync
npm run cap:open
```

Откроется **Android Studio**. Дальше:

1. Дождитесь синхронизации Gradle (первый раз 5–15 минут)
2. Подключите телефон по USB **или** создайте эмулятор (Device Manager)
3. На телефоне: **Настройки → Для разработчиков → Отладка по USB**
4. Нажмите **Run ▶** (зелёный треугольник)

---

## Обновление после изменений в коде

```powershell
cd frontend
npm run cap:sync
```

Затем в Android Studio снова **Run ▶**.

Или одной командой:

```powershell
npm run cap:run
```

---

## Сборка APK для установки

В Android Studio:

**Build → Build Bundle(s) / APK(s) → Build APK(s)**

APK:

```
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

Для Google Play — **Generate Signed Bundle / APK** (AAB).

---

## Backend (CORS)

На сервере после `git pull` перезапустите backend:

```bash
cd /opt/vmeste
git pull
docker compose -f docker-compose.prod.yml up -d --build web
```

В `settings.py` разрешены origin Capacitor: `https://localhost`, `capacitor://localhost`.

---

## Идентификатор приложения

| Поле | Значение |
|------|----------|
| App ID | `space.vsevmeste.app` |
| Название | Вместе |
| API | `https://vsevmeste.space/api` |

Изменить: `frontend/capacitor.config.json`.

---

## Разрешения Android

Для карты и геолокации в `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

---

## Частые проблемы

| Проблема | Решение |
|----------|---------|
| API не отвечает | `VITE_API_URL`, обновить backend (CORS) |
| Белый экран | `npm run cap:sync`, Logcat в Android Studio |
| Gradle долго качает | Первый запуск, нужен интернет |
| `JAVA_HOME` | JDK 17 в Android Studio → Settings |
