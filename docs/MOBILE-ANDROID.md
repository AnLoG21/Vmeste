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

## Push-уведомления (Android) — FCM HTTP v1

Legacy Server key в Firebase **отключён**. Нужен Service Account (V1).

### 1. Service Account JSON

1. [Firebase Console](https://console.firebase.google.com/) → проект **vmeste-32513**
2. ⚙ **Project settings** → вкладка **Service accounts**
3. **Generate new private key** → скачается JSON
4. Переименуйте в `service-account.json` и положите:

**На ПК (для проверки):**  
`Vmeste/firebase-credentials/service-account.json`

**На сервере:**
```bash
# с вашего ПК
scp service-account.json root@ВАШ_IP:/opt/vmeste/firebase-credentials/service-account.json
```

### 2. Серверный `.env`

```env
FIREBASE_CREDENTIALS=/app/firebase-credentials/service-account.json
FIREBASE_PROJECT_ID=vmeste-32513
```

### 3. `google-services.json` в приложении

Уже должен быть в:
`frontend/android/app/google-services.json`

### 4. Деплой backend

```bash
cd /opt/vmeste && git pull && docker compose -f docker-compose.prod.yml up -d --build web
```

### 5. Пересборка APK

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd C:\Users\analo\projects\vmeste\Vmeste\frontend
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

### 6. На телефоне

Установите APK → разрешите уведомления → войдите в аккаунт.

Без `service-account.json` на сервере системные push не уйдут (останутся in-app бейджи).

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
| **`This build uses a Java 8 JVM`** | Gradle нужна Java 11+. См. раздел ниже |
| API не отвечает | `VITE_API_URL`, обновить backend (CORS) |
| Белый экран | `npm run cap:sync`, Logcat в Android Studio |
| Gradle долго качает | Первый запуск, нужен интернет |
| `JAVA_HOME` | JDK 17+ из Android Studio → Settings → Gradle |

---

## Ошибка «This build uses a Java 8 JVM»

На Windows часто в системе стоит старая **Java 8**, а Android Gradle Plugin требует **Java 11+** (лучше **17** из Android Studio).

### Быстро — перед сборкой в PowerShell

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
cd C:\Users\analo\projects\vmeste\Vmeste\frontend\android
.\gradlew.bat assembleDebug
```

### Навсегда (Windows)

1. **Параметры Windows** → **Система** → **О системе** → **Дополнительные параметры системы**
2. **Переменные среды**
3. **JAVA_HOME** (создать или изменить):
   ```
   C:\Program Files\Android\Android Studio\jbr
   ```
4. В **Path** добавить:
   ```
   %JAVA_HOME%\bin
   ```
5. Закрыть и открыть PowerShell, проверить:
   ```powershell
   java -version
   ```
   Должно быть **17** или **21**, не `1.8`.

### Через Android Studio (без командной строки)

**Build → Build Bundle(s) / APK(s) → Build APK(s)** — Studio сама использует правильную Java.

**APK после успешной сборки:**

```
frontend\android\app\build\outputs\apk\debug\app-debug.apk
```
