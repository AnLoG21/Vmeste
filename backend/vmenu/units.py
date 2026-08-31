"""Scale and convert recipe ingredient units."""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

# Base unit for internal scaling: grams for mass, ml for volume, pieces for count
_TO_BASE = {
    "г": ("mass", Decimal("1")),
    "кг": ("mass", Decimal("1000")),
    "мл": ("volume", Decimal("1")),
    "л": ("volume", Decimal("1000")),
    "ч.л.": ("volume", Decimal("5")),
    "ст.л.": ("volume", Decimal("15")),
    "шт.": ("count", Decimal("1")),
}

_DISPLAY_UNITS = {
    "mass": ["г", "кг"],
    "volume": ["мл", "л", "ч.л.", "ст.л."],
    "count": ["шт."],
}


def _q(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def scale_amount(amount, factor) -> Decimal:
    try:
        base = Decimal(str(amount or 0))
    except Exception:
        return Decimal("0")
    return _q(base * Decimal(str(factor)))


def convert_unit(amount, from_unit: str, to_unit: str) -> Decimal | None:
    from_unit = (from_unit or "г").strip()
    to_unit = (to_unit or "г").strip()
    if from_unit == to_unit:
        try:
            return _q(Decimal(str(amount or 0)))
        except Exception:
            return Decimal("0")
    f = _TO_BASE.get(from_unit)
    t = _TO_BASE.get(to_unit)
    if not f or not t or f[0] != t[0]:
        return None
    try:
        val = Decimal(str(amount or 0))
    except Exception:
        return Decimal("0")
    base_val = val * f[1]
    return _q(base_val / t[1])


def scale_ingredients(ingredients, base_servings: int, target_servings: int, display_unit: str | None = None):
    base_servings = max(1, int(base_servings or 1))
    target_servings = max(1, int(target_servings or 1))
    factor = Decimal(target_servings) / Decimal(base_servings)
    out = []
    for ing in ingredients:
        amount = scale_amount(ing.get("amount") if isinstance(ing, dict) else ing.amount, factor)
        unit = (ing.get("unit") if isinstance(ing, dict) else ing.unit) or "г"
        name = ing.get("name") if isinstance(ing, dict) else ing.name
        if display_unit:
            converted = convert_unit(amount, unit, display_unit)
            if converted is not None:
                amount = converted
                unit = display_unit
        out.append({"name": name, "amount": float(amount), "unit": unit})
    return out


def compatible_units(unit: str) -> list[str]:
    meta = _TO_BASE.get((unit or "г").strip())
    if not meta:
        return ["г", "кг", "мл", "л", "ч.л.", "ст.л.", "шт."]
    return _DISPLAY_UNITS.get(meta[0], ["шт."])
