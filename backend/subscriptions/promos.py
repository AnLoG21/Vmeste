"""Known promo codes. Extend here or move to DB later."""

PROMO_CODES = {
    "VSEVMESTE": {
        "plan_slug": "business",
        "days": 30,
        "label": "1 месяц «Бизнес» бесплатно",
    },
}


def normalize_promo_code(raw: str) -> str:
    return (raw or "").strip().upper()
