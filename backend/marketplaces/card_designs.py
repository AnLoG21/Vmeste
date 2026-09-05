"""Default style presets and Fabric starter scenes for card slide designs."""

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

SLIDE_W = 1080
SLIDE_H = 1440


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


def has_canvas_scene(canvas) -> bool:
    return bool(isinstance(canvas, dict) and isinstance(canvas.get("objects"), list) and canvas["objects"])


def build_starter_canvas_json(layout: str = "hero", style: dict | None = None) -> dict:
    """Fabric-compatible starter scene (mirrors frontend buildStarterCanvasJson)."""
    s = normalize_style(style)
    objects: list[dict] = []

    def rect(**kwargs):
        base = {"type": "Rect", "version": "6.0.0", "strokeWidth": 0, "selectable": True}
        base.update(kwargs)
        return base

    def text(**kwargs):
        base = {
            "type": "IText",
            "version": "6.0.0",
            "fontFamily": '"Segoe UI", Tahoma, sans-serif',
            "selectable": True,
        }
        base.update(kwargs)
        return base

    objects.append(
        rect(left=0, top=0, width=SLIDE_W, height=56, fill=s["accent"], vmRole="brandBar")
    )
    objects.append(
        text(
            left=28,
            top=14,
            text=str(s.get("brandBarText") or "Моя витрина")[:40],
            fontSize=22,
            fontWeight="600",
            fill="#ffffff",
            vmRole="brandText",
        )
    )

    layout = (layout or "hero").strip()
    if layout == "benefits":
        objects.append(rect(left=48, top=88, width=520, height=1260, rx=28, ry=28, fill=s["panel"], vmRole="panel"))
        objects.append(
            rect(left=68, top=108, width=480, height=1220, fill=s["accentSoft"], vmRole="productPhoto")
        )
        objects.append(rect(left=596, top=88, width=436, height=1260, rx=28, ry=28, fill=s["panel"]))
        objects.append(
            text(
                left=632,
                top=130,
                text=str(s.get("benefitsTitle") or "Почему берут"),
                fontSize=28,
                fontWeight="700",
                fill=s["accent"],
            )
        )
        objects.append(
            text(
                left=632,
                top=180,
                text="{{name}}",
                fontSize=30,
                fontFamily="Georgia, serif",
                fontWeight="700",
                fill=s["ink"],
                vmRole="productName",
            )
        )
        for i, label in enumerate(("Качество", "Доставка", "Гарантия")):
            objects.append(
                text(left=632, top=280 + i * 120, text=f"{i + 1}. {label}", fontSize=24, fill=s["ink"])
            )
    elif layout == "specs":
        objects.append(rect(left=48, top=88, width=SLIDE_W - 96, height=720, rx=28, ry=28, fill=s["panel"]))
        objects.append(
            rect(
                left=72,
                top=112,
                width=SLIDE_W - 144,
                height=672,
                fill=s["accentSoft"],
                vmRole="productPhoto",
            )
        )
        objects.append(rect(left=48, top=840, width=SLIDE_W - 96, height=520, rx=28, ry=28, fill=s["panel"]))
        objects.append(
            text(
                left=88,
                top=880,
                text="{{name}}",
                fontSize=34,
                fontFamily="Georgia, serif",
                fontWeight="700",
                fill=s["ink"],
                vmRole="productName",
            )
        )
        objects.append(
            text(
                left=88,
                top=940,
                text="{{price}}",
                fontSize=28,
                fontWeight="700",
                fill=s["badge"],
                vmRole="productPrice",
            )
        )
    else:
        objects.append(rect(left=48, top=88, width=SLIDE_W - 96, height=980, rx=28, ry=28, fill=s["panel"]))
        objects.append(
            rect(
                left=72,
                top=112,
                width=SLIDE_W - 144,
                height=760,
                fill=s["accentSoft"],
                vmRole="productPhoto",
            )
        )
        objects.append(
            text(
                left=88,
                top=920,
                text="{{name}}",
                fontSize=42,
                fontFamily="Georgia, serif",
                fontWeight="700",
                fill=s["ink"],
                vmRole="productName",
            )
        )
        objects.append(
            text(
                left=88,
                top=990,
                text="{{price}}",
                fontSize=30,
                fontWeight="700",
                fill="#ffffff",
                backgroundColor=s["badge"],
                vmRole="productPrice",
            )
        )
        objects.append(
            text(
                left=88,
                top=1050,
                text="{{brand}}",
                fontSize=22,
                fill=s["muted"],
                vmRole="productBrand",
            )
        )

    return {
        "version": "6.0.0",
        "objects": objects,
        "background": s["bg"],
    }
