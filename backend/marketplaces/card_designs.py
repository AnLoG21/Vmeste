"""Default style presets for user card slide designs."""

DEFAULT_STYLE = {
    "bg": "#f6f3ee",
    "panel": "#ffffff",
    "ink": "#1a242e",
    "muted": "#5c6b78",
    "accent": "#0f6e56",
    "accentSoft": "#d8efe6",
    "line": "#e2ddd4",
    "badge": "#c45c26",
    "brandBarText": "Моя витрина",
    "benefitsTitle": "Почему берут",
    "showPrice": True,
    "showBrand": True,
    "logoUrl": "",
}

STARTER_DESIGNS = [
    {
        "name": "Главный кадр",
        "layout": "hero",
        "style": {**DEFAULT_STYLE, "brandBarText": "Витрина · главный"},
    },
    {
        "name": "Преимущества",
        "layout": "benefits",
        "style": {**DEFAULT_STYLE, "brandBarText": "Витрина · плюсы", "benefitsTitle": "Почему берут"},
    },
    {
        "name": "Характеристики",
        "layout": "specs",
        "style": {**DEFAULT_STYLE, "brandBarText": "Витрина · факты"},
    },
]


def normalize_style(raw: dict | None) -> dict:
    base = dict(DEFAULT_STYLE)
    if not isinstance(raw, dict):
        return base
    for key in DEFAULT_STYLE:
        if key not in raw:
            continue
        val = raw[key]
        if key in ("showPrice", "showBrand"):
            base[key] = bool(val)
        elif key == "logoUrl":
            base[key] = str(val or "")[:500]
        elif key in ("brandBarText", "benefitsTitle"):
            base[key] = str(val or "")[:80]
        else:
            s = str(val or "").strip()
            if s.startswith("#") and 4 <= len(s) <= 9:
                base[key] = s
    return base
