"""Cuisine catalog and detection from recipe page metadata."""

from __future__ import annotations

import re
from html import unescape

# slug, display name, sort order
DEFAULT_CUISINES: list[tuple[str, str, int]] = [
    ("russian", "Русская", 1),
    ("ukrainian", "Украинская", 2),
    ("belarusian", "Белорусская", 3),
    ("georgian", "Грузинская", 4),
    ("armenian", "Армянская", 5),
    ("azerbaijani", "Азербайджанская", 6),
    ("uzbek", "Узбекская", 7),
    ("tatar", "Татарская", 8),
    ("italian", "Итальянская", 10),
    ("french", "Французская", 11),
    ("spanish", "Испанская", 12),
    ("greek", "Греческая", 13),
    ("german", "Немецкая", 14),
    ("british", "Британская", 15),
    ("american", "Американская", 16),
    ("mexican", "Мексиканская", 17),
    ("chinese", "Китайская", 20),
    ("japanese", "Японская", 21),
    ("korean", "Корейская", 22),
    ("thai", "Тайская", 23),
    ("indian", "Индийская", 24),
    ("vietnamese", "Вьетнамская", 25),
    ("turkish", "Турецкая", 26),
    ("mediterranean", "Средиземноморская", 30),
    ("european", "Европейская", 31),
    ("asian", "Азиатская", 32),
    ("caucasian", "Кавказская", 33),
    ("jewish", "Еврейская", 34),
    ("home", "Домашняя", 40),
    ("international", "Международная", 41),
]

_ALIASES: dict[str, str] = {}
for slug, name, _ in DEFAULT_CUISINES:
    _ALIASES[slug] = slug
    _ALIASES[name.lower()] = slug

_EXTRA_ALIASES = {
    "русская": "russian",
    "русский": "russian",
    "украинская": "ukrainian",
    "белорусская": "belarusian",
    "грузинская": "georgian",
    "армянская": "armenian",
    "азербайджанская": "azerbaijani",
    "узбекская": "uzbek",
    "татарская": "tatar",
    "итальянская": "italian",
    "итальянский": "italian",
    "французская": "french",
    "французский": "french",
    "испанская": "spanish",
    "греческая": "greek",
    "немецкая": "german",
    "британская": "british",
    "английская": "british",
    "американская": "american",
    "мексиканская": "mexican",
    "китайская": "chinese",
    "японская": "japanese",
    "корейская": "korean",
    "тайская": "thai",
    "индийская": "indian",
    "вьетнамская": "vietnamese",
    "турецкая": "turkish",
    "средиземноморская": "mediterranean",
    "европейская": "european",
    "азиатская": "asian",
    "кавказская": "caucasian",
    "еврейская": "jewish",
    "домашняя": "home",
    "международная": "international",
    "советская": "russian",
    "ссср": "russian",
    "постная": "russian",
    "вегетарианская": "international",
    "веганская": "international",
}
_ALIASES.update(_EXTRA_ALIASES)


def normalize_cuisine_slug(raw: str) -> str | None:
    if not raw:
        return None
    text = unescape(str(raw)).strip().lower()
    text = re.sub(r"\s+", " ", text)
    if text in _ALIASES:
        return _ALIASES[text]
    for slug, name, _ in DEFAULT_CUISINES:
        if slug in text or name.lower() in text:
            return slug
    for alias, slug in _EXTRA_ALIASES.items():
        if alias in text:
            return slug
    return None


def detect_cuisine_slug(recipe_ld: dict, html: str, title: str = "", description: str = "") -> str | None:
    candidates: list[str] = []
    cuisine = recipe_ld.get("recipeCuisine")
    if isinstance(cuisine, list):
        candidates.extend(str(x) for x in cuisine)
    elif cuisine:
        candidates.append(str(cuisine))
    keywords = recipe_ld.get("keywords")
    if isinstance(keywords, list):
        candidates.extend(str(x) for x in keywords)
    elif keywords:
        candidates.extend(re.split(r"[,;|]", str(keywords)))
    for prop in ("articleSection", "category"):
        val = recipe_ld.get(prop)
        if val:
            candidates.append(str(val))
    for m in re.finditer(
        r'<meta[^>]+(?:property|name)=["\'](?:recipe:cuisine|cuisine)["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.I,
    ):
        candidates.append(m.group(1))
    for m in re.finditer(
        r'(?:кухн[яи]|nationality|category)[^>]{0,40}>([^<]{2,60})<',
        html,
        re.I,
    ):
        candidates.append(m.group(1))
    for m in re.finditer(
        r'itemprop=["\'](?:recipeCuisine|suitableForDiet)["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.I,
    ):
        candidates.append(m.group(1))
    # breadcrumbs / tags on Russian sites
    for m in re.finditer(
        r'class="[^"]*(?:tag|badge|label|breadcrumb)[^"]*"[^>]*>([^<]{2,50})<',
        html,
        re.I,
    ):
        t = m.group(1).strip()
        if re.search(r"кухн|kitchen|cuisine", t, re.I) or normalize_cuisine_slug(t):
            candidates.append(t)
    blob = " ".join([title, description] + candidates)
    for part in re.split(r"[,;|/•·]", blob):
        slug = normalize_cuisine_slug(part)
        if slug:
            return slug
    for part in candidates:
        slug = normalize_cuisine_slug(part)
        if slug:
            return slug
    return None
