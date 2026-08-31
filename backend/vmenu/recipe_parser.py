"""Best-effort recipe import from external URLs (title, description, ingredients, images)."""

from __future__ import annotations

import json
import re
from html import unescape
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

_USER_AGENT = "VmesteVmenuBot/1.0 (+https://vsevmeste.space)"

_UNIT_ALIASES = {
    "г": "г",
    "гр": "г",
    "грамм": "г",
    "кг": "кг",
    "мл": "мл",
    "л": "л",
    "литр": "л",
    "ч.л.": "ч.л.",
    "чл": "ч.л.",
    "чайная": "ч.л.",
    "ст.л.": "ст.л.",
    "стл": "ст.л.",
    "столовая": "ст.л.",
    "шт": "шт.",
    "шт.": "шт.",
    "штук": "шт.",
    "стакан": "стакан",
    "стакана": "стакан",
    "стаканов": "стакан",
    "щепотка": "щепотка",
    "щепотки": "щепотка",
}


def _fetch_html(url: str, timeout: int = 12) -> str:
    req = Request(url, headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read(400_000)
    for enc in ("utf-8", "cp1251", "latin-1"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", errors="replace")


def strip_html(text: str) -> str:
    if not text:
        return ""
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</p>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    text = unescape(text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _meta(html: str, prop: str) -> str:
    m = re.search(
        rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']+)["\']',
        html,
        re.I,
    )
    if not m:
        m = re.search(
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']',
            html,
            re.I,
        )
    return unescape(m.group(1).strip()) if m else ""


def _title_tag(html: str) -> str:
    m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    return unescape(m.group(1).strip()) if m else ""


def _json_ld_recipe(html: str) -> dict:
    for block in re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.I | re.S,
    ):
        try:
            data = json.loads(block.strip())
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("@type") in ("Recipe", ["Recipe"]):
                return item
            if isinstance(item, dict) and "@graph" in item:
                for g in item["@graph"]:
                    if isinstance(g, dict) and g.get("@type") == "Recipe":
                        return g
    return {}


def _normalize_unit(raw: str) -> str:
    key = (raw or "").strip().lower().rstrip(".")
    return _UNIT_ALIASES.get(key, raw.strip()[:40] if raw else "шт.")


def _parse_amount_unit_tail(tail: str) -> tuple[str, str]:
    tail = tail.strip()
    low = tail.lower()
    if low in ("по вкусу", "щепотка", "щепотки", "немного"):
        return "0", _normalize_unit(tail)
    m = re.match(
        r"^([\d]+(?:[.,]\d+)?(?:\s*[-–]\s*[\d]+(?:[.,]\d+)?)?)\s*(.*)$",
        tail,
        re.I,
    )
    if m:
        amount = m.group(1).replace(",", ".").replace(" ", "")
        unit_raw = (m.group(2) or "шт.").strip()
        if not unit_raw:
            unit_raw = "шт."
        return amount, _normalize_unit(unit_raw)
    m2 = re.match(r"^([а-яa-zё.]+)\s+(.+)$", tail, re.I)
    if m2 and _normalize_unit(m2.group(1)) != m2.group(1):
        return "1", _normalize_unit(m2.group(1))
    return "0", tail[:40] if tail else ""


def _parse_ingredient_line(text: str) -> dict | None:
    text = strip_html(text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or len(text) < 2:
        return None
    for sep in (" - ", " – ", " — ", " -", " –", " —"):
        if sep.strip() in text or sep in text:
            parts = re.split(r"\s*[-–—]\s*", text, maxsplit=1)
            if len(parts) == 2:
                name, tail = parts[0].strip(), parts[1].strip()
                amount, unit = _parse_amount_unit_tail(tail)
                return {"name": name[:200], "amount": amount, "unit": unit}
    m = re.match(r"^([\d.,]+(?:\s*[-–]\s*[\d.,]+)?)\s*([а-яa-z.%]+)?\s+(.+)$", text, re.I)
    if m:
        return {
            "name": m.group(3).strip()[:200],
            "amount": m.group(1).replace(",", "."),
            "unit": _normalize_unit(m.group(2) or "шт."),
        }
    return {"name": text[:200], "amount": "0", "unit": ""}


def _parse_ingredients(recipe_ld: dict, html: str) -> list[dict]:
    raw = recipe_ld.get("recipeIngredient") or recipe_ld.get("ingredients") or []
    out = []
    for line in raw[:40]:
        row = _parse_ingredient_line(str(line))
        if row:
            out.append(row)
    if out:
        return out
    block = re.search(
        r"(?:ингредиенты|состав)[^<]*</[^>]+>\s*<[^>]+>(.*?)</",
        html,
        re.I | re.S,
    )
    if block:
        for line in re.split(r"<br\s*/?>|\n|</li>", block.group(1)):
            row = _parse_ingredient_line(line)
            if row:
                out.append(row)
    return out


def _parse_steps(recipe_ld: dict) -> list[dict]:
    instr = recipe_ld.get("recipeInstructions") or []
    out = []
    for block in instr[:30]:
        if isinstance(block, dict):
            text = block.get("text") or block.get("name") or ""
        else:
            text = str(block)
        text = strip_html(text)
        if text:
            out.append({"text": text})
    return out


def _collect_image_urls(recipe_ld: dict, html: str, base_url: str) -> list[str]:
    urls: list[str] = []
    img = recipe_ld.get("image")
    if isinstance(img, str):
        urls.append(img)
    elif isinstance(img, list):
        urls.extend([u for u in img if isinstance(u, str)])
    elif isinstance(img, dict) and img.get("url"):
        urls.append(img["url"])
    og = _meta(html, "og:image")
    if og:
        urls.append(og)
    seen = set()
    out = []
    for u in urls:
        if not u:
            continue
        full = urljoin(base_url, u)
        if full not in seen:
            seen.add(full)
            out.append(full)
    return out[:5]


def parse_recipe_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Нужна ссылка http или https")
    html = _fetch_html(url)
    ld = _json_ld_recipe(html)
    title = (ld.get("name") or _meta(html, "og:title") or _title_tag(html) or "Импортированный рецепт").strip()
    description = strip_html(
        ld.get("description") or _meta(html, "og:description") or _meta(html, "description") or ""
    )[:2000]
    ingredients = _parse_ingredients(ld, html)
    steps = _parse_steps(ld)
    image_urls = _collect_image_urls(ld, html, url)
    servings = 4
    try:
        yield_val = ld.get("recipeYield") or ""
        if isinstance(yield_val, list):
            yield_val = yield_val[0] if yield_val else ""
        m = re.search(r"(\d+)", str(yield_val))
        if m:
            servings = max(1, min(99, int(m.group(1))))
    except Exception:
        pass
    return {
        "title": title[:200],
        "description": description,
        "source_url": url,
        "servings": servings,
        "ingredients": ingredients,
        "steps": steps or [{"text": "Отредактируйте шаги приготовления."}],
        "image_urls": image_urls,
    }


def download_image(url: str, max_bytes: int = 4_000_000) -> tuple[bytes, str]:
    req = Request(url, headers={"User-Agent": _USER_AGENT})
    with urlopen(req, timeout=15) as resp:
        data = resp.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ValueError("Изображение слишком большое")
    name = urlparse(url).path.split("/")[-1].split("?")[0] or "image.jpg"
    if "." not in name:
        name += ".jpg"
    return data, name[:120]
