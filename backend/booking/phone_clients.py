"""Поиск и создание клиентов по телефону (без дублей при разном формате номера)."""

from __future__ import annotations

import re
import secrets

from django.contrib.auth import get_user_model

User = get_user_model()


def phone_digits(raw: str) -> str:
    digits = re.sub(r"\D+", "", raw or "")
    if len(digits) >= 11 and digits[0] in "78":
        return digits[-10:]
    if len(digits) > 10:
        return digits[-10:]
    return digits if len(digits) >= 10 else ""


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D+", "", raw or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("7"):
        return "+" + digits
    return (raw or "").strip()[:30]


def find_client_by_phone(phone: str):
    """Найти клиента по номеру: точное совпадение нормализованного или по 10 цифрам."""
    phone_n = normalize_phone(phone)
    needle = phone_digits(phone_n) or phone_digits(phone)
    if not needle:
        return None
    exact = User.objects.filter(phone=phone_n, role=User.Role.CLIENT).first()
    if exact:
        return exact
    # Кандидаты по хвосту номера, затем точное сравнение цифр
    for fragment in (needle[-7:], needle[-4:]):
        qs = (
            User.objects.filter(role=User.Role.CLIENT)
            .exclude(phone="")
            .filter(phone__icontains=fragment)
        )
        for u in qs.iterator(chunk_size=200):
            if phone_digits(u.phone) == needle:
                return u
    return None


def _apply_name(user, name: str) -> None:
    if not name or not user:
        return
    if (user.first_name or "").strip():
        return
    parts = name.strip().split(None, 1)
    user.first_name = parts[0][:30]
    if len(parts) > 1:
        user.last_name = parts[1][:30]
    user.save(update_fields=["first_name", "last_name"])


def get_or_create_client_by_phone(*, phone: str, name: str = ""):
    """
    Найти существующего клиента по телефону или создать guest-аккаунт.
    Не создаёт дубли при +7 / 8 / без кода.
    """
    phone_n = normalize_phone(phone)
    if len(phone_digits(phone_n)) < 10:
        raise ValueError("Укажите корректный телефон.")
    existing = find_client_by_phone(phone_n)
    if existing:
        _apply_name(existing, name)
        # Нормализуем сохранённый телефон, если был в другом формате
        if (existing.phone or "").strip() != phone_n:
            existing.phone = phone_n
            existing.save(update_fields=["phone"])
        return existing
    base = f"guest_{re.sub(r'\D+', '', phone_n)[-10:]}"
    username = base
    for _ in range(8):
        if not User.objects.filter(username=username).exists():
            break
        username = f"{base}_{secrets.token_hex(2)}"
    parts = (name or "").strip().split(None, 1)
    user = User(
        username=username,
        role=User.Role.CLIENT,
        phone=phone_n,
        first_name=(parts[0] if parts else "")[:30],
        last_name=(parts[1] if len(parts) > 1 else "")[:30],
    )
    user.set_unusable_password()
    user.save()
    return user


def client_brief(user) -> dict:
    if not user:
        return {}
    parts = [user.first_name or "", user.last_name or ""]
    name = " ".join(p for p in parts if p).strip() or user.username
    return {
        "id": user.id,
        "username": user.username,
        "phone": user.phone or "",
        "name": name,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
    }
