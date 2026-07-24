import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
_REPO_ROOT = BASE_DIR.parent

# UTF-8: иначе на Windows пароль/комментарии в .env в другой кодировке дают ошибки при connect (UnicodeDecodeError в psycopg2).
for _env_path in (_REPO_ROOT / ".env", BASE_DIR / ".env"):
    if _env_path.is_file():
        load_dotenv(_env_path, encoding="utf-8")
        break
else:
    load_dotenv(encoding="utf-8")


def _env_str(name: str, default: str = "") -> str:
    """Строка из окружения в корректном Unicode (защита от битых байт в переменных Windows)."""
    val = os.environ.get(name, default)
    if val is None:
        return default
    if isinstance(val, bytes):
        return val.decode("utf-8", errors="replace")
    if not isinstance(val, str):
        return str(val)
    try:
        val.encode("utf-8")
        return val
    except UnicodeEncodeError:
        return val.encode("latin-1", errors="replace").decode("utf-8", errors="replace")

SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-change-me")
DEBUG = os.environ.get("DEBUG", "0") in ("1", "true", "True", "yes")

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")

_csrf_origins_env = os.environ.get("CSRF_TRUSTED_ORIGINS", "")
if _csrf_origins_env.strip():
    CSRF_TRUSTED_ORIGINS = [o.strip() for o in _csrf_origins_env.split(",") if o.strip()]
elif FRONTEND_URL.startswith("http"):
    CSRF_TRUSTED_ORIGINS = [FRONTEND_URL]
    if FRONTEND_URL.startswith("https://"):
        _host = FRONTEND_URL.removeprefix("https://")
        CSRF_TRUSTED_ORIGINS.append(f"https://www.{_host}")
else:
    CSRF_TRUSTED_ORIGINS = []

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "users",
    "catalog",
    "booking",
    "locations",
    "chat",
    "notifications",
    "reviews",
    "subscriptions",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": _env_str("POSTGRES_DB", "vmeste"),
        "USER": _env_str("POSTGRES_USER", "vmeste_user"),
        "PASSWORD": _env_str("POSTGRES_PASSWORD", "vmeste_pass"),
        "HOST": _env_str("POSTGRES_HOST", "localhost"),
        "PORT": _env_str("POSTGRES_PORT", "5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "ru-ru"
TIME_ZONE = "Europe/Moscow"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
}

CORS_ALLOW_ALL_ORIGINS = DEBUG
_cors_origins_env = os.environ.get("CORS_ALLOWED_ORIGINS", "")
if _cors_origins_env.strip():
    CORS_ALLOWED_ORIGINS = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
else:
    CORS_ALLOWED_ORIGINS = [
        FRONTEND_URL,
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]
    if FRONTEND_URL.startswith("https://"):
        _fe_host = FRONTEND_URL.removeprefix("https://").removeprefix("www.")
        CORS_ALLOWED_ORIGINS.append(f"https://www.{_fe_host}")

# Capacitor Android/iOS WebView (fetch с https://localhost на API)
for _cap_origin in ("https://localhost", "capacitor://localhost", "http://localhost"):
    if _cap_origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(_cap_origin)

SKIP_EMAIL_VERIFICATION = os.environ.get("SKIP_EMAIL_VERIFICATION", "0") in ("1", "true", "True", "yes")

EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.environ.get("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.environ.get("EMAIL_USE_TLS", "1") in ("1", "true", "True", "yes")
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Вместе <vmesteofficialsupport@gmail.com>")
SUPPORT_EMAIL = os.environ.get("SUPPORT_EMAIL", "vmesteofficialsupport@gmail.com")

YOOKASSA_SHOP_ID = os.environ.get("YOOKASSA_SHOP_ID", "")
YOOKASSA_SECRET_KEY = os.environ.get("YOOKASSA_SECRET_KEY", "")
# FCM HTTP v1: path to Firebase service account JSON inside the container/host
FIREBASE_CREDENTIALS = os.environ.get("FIREBASE_CREDENTIALS", "")
FIREBASE_PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "")
# Deprecated legacy key (ignored; kept for old .env compatibility)
FCM_SERVER_KEY = os.environ.get("FCM_SERVER_KEY", "")

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "1" if DEBUG else "0") in (
    "1",
    "true",
    "True",
)
