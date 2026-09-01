"""Best-effort recipe import from external URLs (title, description, ingredients, images)."""

from __future__ import annotations

import json
import re
from decimal import Decimal, InvalidOperation
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
    "зубчик": "зубчик",
    "зубчика": "зубчик",
    "зубчиков": "зубчик",
    "ст. л.": "ст.л.",
    "ст.л": "ст.л.",
    "ст л": "ст.л.",
    "ч. л.": "ч.л.",
    "ч.л": "ч.л.",
    "по вкусу": "по вкусу",
}


def _fetch_html(url: str, timeout: int = 12) -> str:
    req = Request(url, headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read(500_000)
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


def _is_recipe_type(val) -> bool:
    if val in ("Recipe", ["Recipe"]):
        return True
    if isinstance(val, list):
        return "Recipe" in val
    if isinstance(val, str):
        return val == "Recipe" or val.endswith("Recipe")
    return False


def _find_recipe_in_ld(data) -> dict | None:
    if isinstance(data, dict):
        if _is_recipe_type(data.get("@type")):
            return data
        for key in ("@graph", "mainEntity", "itemListElement"):
            nested = data.get(key)
            if isinstance(nested, list):
                for item in nested:
                    found = _find_recipe_in_ld(item)
                    if found:
                        return found
            elif nested:
                found = _find_recipe_in_ld(nested)
                if found:
                    return found
    elif isinstance(data, list):
        for item in data:
            found = _find_recipe_in_ld(item)
            if found:
                return found
    return None


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
        found = _find_recipe_in_ld(data)
        if found:
            return found
    return {}


def _normalize_unit(raw: str) -> str:
    text = re.sub(r"\s+", " ", (raw or "").strip().lower())
    text = re.sub(r"ст\.\s*л\.?", "ст. л.", text)
    text = re.sub(r"ч\.\s*л\.?", "ч. л.", text)
    key = text.rstrip(".")
    if key in _UNIT_ALIASES:
        return _UNIT_ALIASES[key]
    key_dot = key + "." if not key.endswith(".") else key
    return _UNIT_ALIASES.get(key_dot, raw.strip()[:40] if raw else "")


def _safe_decimal(val) -> Decimal:
    if val is None or val == "":
        return Decimal("0")
    try:
        s = str(val).replace(",", ".").strip()
        if not s or s in ("-", "—"):
            return Decimal("0")
        if re.search(r"[-–]", s) and not re.match(r"^[\d.,]+[-–][\d.,]+$", s):
            return Decimal("0")
        return Decimal(re.sub(r"[^\d.]", "", s) or "0")
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _split_ingredient_names(name: str) -> list[str]:
    names: list[str] = []
    for chunk in re.split(r",\s*", name):
        chunk = chunk.strip()
        if not chunk:
            continue
        if re.search(r"\s+и\s+", chunk, re.I):
            for part in re.split(r"\s+и\s+", chunk, flags=re.I):
                part = part.strip()
                if part:
                    names.append(part)
        else:
            names.append(chunk)
    return names


def _parse_amount_unit_tail(tail: str) -> tuple[str, str]:
    tail = re.sub(r"\s+", " ", (tail or "").strip())
    tail = re.sub(r"ст\.\s*л\.?", "ст.л.", tail, flags=re.I)
    tail = re.sub(r"ч\.\s*л\.?", "ч.л.", tail, flags=re.I)
    low = tail.lower()
    if low in ("по вкусу", "щепотка", "щепотки", "немного") or low.startswith("по вкусу"):
        return "", "по вкусу"
    m_zub = re.match(r"^(\d+)\s+зубчик", low, re.I)
    if m_zub:
        return m_zub.group(1), "зубчик"
    if re.fullmatch(r"зубчик[аов]*", low):
        return "1", "зубчик"
    m = re.match(
        r"^([\d]+(?:[.,]\d+)?(?:\s*[-–]\s*[\d]+(?:[.,]\d+)?)?)\s*(.*)$",
        tail,
        re.I,
    )
    if m:
        amount = m.group(1).replace(",", ".").replace(" ", "")
        unit_raw = (m.group(2) or "").strip()
        if not unit_raw:
            return amount, "шт."
        return amount, _normalize_unit(unit_raw) or unit_raw
    m2 = re.match(r"^([а-яa-zё.]+)$", tail, re.I)
    if m2 and _normalize_unit(m2.group(1)) != m2.group(1):
        return "1", _normalize_unit(m2.group(1))
    return "", tail[:40] if tail else ""


def _ingredient_rows_from_names(names: list[str], amount: str, unit: str) -> list[dict]:
    return [{"name": name[:200], "amount": amount, "unit": unit} for name in names if name]


def _parse_ingredient_line(text: str) -> dict | list[dict] | None:
    text = strip_html(text)
    text = re.sub(r"\s+", " ", text).strip()
    if not text or len(text) < 2:
        return None
    if re.match(r"^(ингредиент|состав|на\s+\d+\s+порц)", text, re.I):
        return None
    parts = re.split(r"\s*[-–—]\s*", text, maxsplit=1)
    if len(parts) == 2:
        name, tail = parts[0].strip(), parts[1].strip()
        amount, unit = _parse_amount_unit_tail(tail)
        names = _split_ingredient_names(name)
        if len(names) > 1:
            return _ingredient_rows_from_names(names, amount, unit)
        return {"name": name[:200], "amount": amount, "unit": unit}
    m = re.match(r"^([\d.,]+(?:\s*[-–]\s*[\d.,]+)?)\s*([а-яa-z.%]+)?\s+(.+)$", text, re.I)
    if m:
        return {
            "name": m.group(3).strip()[:200],
            "amount": m.group(1).replace(",", ".").replace(" ", ""),
            "unit": _normalize_unit(m.group(2) or "") or (m.group(2) or "шт."),
        }
    return {"name": text[:200], "amount": "", "unit": ""}


def _append_ingredient_row(out: list[dict], seen: set[str], row: dict | list[dict] | None) -> None:
    if not row:
        return
    rows = row if isinstance(row, list) else [row]
    for item in rows:
        if item and item.get("name") and item["name"] not in seen:
            seen.add(item["name"])
            out.append(item)


def _parse_ingredient_item(line) -> dict | None:
    if isinstance(line, dict):
        name = (line.get("name") or "").strip()
        if not name:
            return None
        val = line.get("value") or line.get("amount") or ""
        if isinstance(val, dict):
            val = val.get("value") or val.get("name") or ""
        val = str(val).strip()
        if val:
            if re.search(r"[-–—]", val) and not re.match(r"^[\d.,]", val):
                combined = _parse_ingredient_line(f"{name} - {val}")
                if combined:
                    return combined
            amount, unit = _parse_amount_unit_tail(val)
            return {"name": name[:200], "amount": amount, "unit": unit}
        return {"name": name[:200], "amount": "", "unit": ""}
    return _parse_ingredient_line(str(line))


def _split_comma_ingredient(text: str) -> dict | list[dict] | None:
    text = strip_html(text)
    if "," not in text and not re.search(r"\s+и\s+", text, re.I):
        return None
    if "," in text:
        name, tail = [p.strip() for p in text.rsplit(",", 1)]
        if not name:
            return None
        amount, unit = _parse_amount_unit_tail(tail)
        if not amount and not unit and tail and not re.match(
            r"^(по\s+вкусу|зубчик|щепотка|немного|\d)", tail, re.I
        ):
            return _parse_ingredient_line(text)
        names = _split_ingredient_names(name)
        if len(names) > 1:
            return _ingredient_rows_from_names(names, amount, unit)
        return {"name": name[:200], "amount": amount, "unit": unit}
    return _parse_ingredient_line(text)


def _parse_ingredients_from_html(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'<meta[^>]+itemprop=["\']recipeIngredient["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.I,
    ):
        _append_ingredient_row(out, seen, _split_comma_ingredient(m.group(1)) or _parse_ingredient_line(m.group(1)))
    for m in re.finditer(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+itemprop=["\']recipeIngredient["\']',
        html,
        re.I,
    ):
        _append_ingredient_row(out, seen, _split_comma_ingredient(m.group(1)) or _parse_ingredient_line(m.group(1)))
    for m in re.finditer(
        r'itemprop=["\']recipeIngredient["\'][^>]*>(.*?)</(?:span|li|p|div|a)>',
        html,
        re.I | re.S,
    ):
        inner = m.group(1)
        if inner.strip().startswith("<"):
            inner = re.sub(r"<a[^>]*>(.*?)</a>", r"\1", inner, flags=re.I | re.S)
        _append_ingredient_row(out, seen, _split_comma_ingredient(inner) or _parse_ingredient_line(inner))
    for m in re.finditer(
        r'class="[^"]*(?:ingredient|recipe-ingredient)[^"]*"[^>]*>(.*?)</li>',
        html,
        re.I | re.S,
    ):
        _append_ingredient_row(out, seen, _parse_ingredient_line(m.group(1)))
    return out


def _parse_ingredients(recipe_ld: dict, html: str) -> list[dict]:
    html_rows = _parse_ingredients_from_html(html)
    if html_rows and any(r.get("amount") for r in html_rows):
        return html_rows
    raw = recipe_ld.get("recipeIngredient") or recipe_ld.get("ingredients") or []
    out = []
    for line in raw[:40]:
        if isinstance(line, str) and "," in line:
            row = _split_comma_ingredient(line) or _parse_ingredient_item(line)
        else:
            row = _parse_ingredient_item(line)
        if row:
            out.append(row)
    if out:
        return out
    if html_rows:
        return html_rows
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


def _step_image_url(block) -> str:
    if isinstance(block, dict):
        img = block.get("image")
        if isinstance(img, str):
            return img
        if isinstance(img, list) and img:
            first = img[0]
            return first if isinstance(first, str) else (first.get("url") or "")
        if isinstance(img, dict):
            return img.get("url") or ""
    return ""


def _clean_step_text(text: str) -> str:
    text = re.sub(r"<[^>]*$", "", text or "")
    text = strip_html(text)
    text = re.sub(r"^>\s*", "", text)
    text = re.sub(r"^(?:Шаг|Step)\s+\d+\s*[:.)-]?\s*", "", text, flags=re.I).strip()
    text = re.sub(r"\s+", " ", text).strip()
    return text


_GASTRONOM_STEP_HTML_STOP = re.compile(
    r"(?:"
    r"<(?:div|section|aside|article|footer)[^>]*\bclass=\"[^\"]*"
    r"(?:tip|advice|useful|similar|related|comments|comment|subscribe|subscription|rating|source|error-report|share|tags|hashtag)"
    r"[^\"]*\"[^>]*>"
    r"|<h[1-6][^>]*>\s*(?:Полезный совет|Кстати|Похожие|Комментари|Оценить|Источник|Лучшие рецепты|Еще больше)"
    r")",
    re.I | re.S,
)

_GASTRONOM_STEP_TEXT_STOP = re.compile(
    r"\s+(?:"
    r"ПОЛЕЗНЫЙ СОВЕТ|"
    r"КСТАТИ|"
    r"Если вы заметили ошибку|"
    r"Источник:|"
    r"Похожие материалы|"
    r"Комментарии|"
    r"Оценить рецепт|"
    r"Лучшие рецепты и идеи|"
    r"Еще больше идей"
    r")\b",
    re.I,
)


def _truncate_gastronom_step_html(html_fragment: str) -> str:
    html_fragment = html_fragment or ""
    m = _GASTRONOM_STEP_HTML_STOP.search(html_fragment)
    if m:
        html_fragment = html_fragment[: m.start()]
    return html_fragment


def _trim_gastronom_step_tail(text: str) -> str:
    if not text:
        return text
    m = _GASTRONOM_STEP_TEXT_STOP.search(text)
    if m:
        text = text[: m.start()]
    return text.strip()


def _gastronom_step_body_text(html_fragment: str) -> str:
    chunk = _truncate_gastronom_step_html(html_fragment)
    chunk = re.split(r"<h[1-6]\b", chunk, maxsplit=1, flags=re.I)[0]
    chunk = re.sub(r"<img[^>]*>", "", chunk, flags=re.I)
    text = _clean_step_text(chunk)
    return _trim_gastronom_step_tail(text)


def _split_long_step_text(text: str) -> list[str]:
    text = _clean_step_text(text)
    if not text:
        return []
    parts = re.split(r"(?=(?:Шаг|Step)\s+\d+\s*[:.)-]?\s*)", text, flags=re.I)
    parts = [p.strip() for p in parts if p.strip()]
    if len(parts) > 1:
        return [_clean_step_text(p) for p in parts if _clean_step_text(p)]
    if len(text) > 420:
        return []
    return [text]


def _parse_steps_from_html(html: str, base_url: str) -> list[dict]:
    out: list[dict] = []
    for m in re.finditer(
        r'class="[^"]*_editorjsContent[^"]*"[^>]*>(.*?)</div>\s*</div>',
        html,
        re.I | re.S,
    ):
        block = m.group(1)
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', block, re.I)
        img = urljoin(base_url, unescape(img_m.group(1))) if img_m else ""
        for text in _split_long_step_text(block):
            if text or img:
                out.append({"text": text, "image_url": img})
                img = ""
    if out:
        return out
    for m in re.finditer(
        r'class="[^"]*(?:step|cooking-step|recipe-step)[^"]*"[^>]*>(.*?)</(?:li|div|p)>',
        html,
        re.I | re.S,
    ):
        block = m.group(1)
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', block, re.I)
        img = urljoin(base_url, unescape(img_m.group(1))) if img_m else ""
        for text in _split_long_step_text(block):
            if text:
                out.append({"text": text, "image_url": img})
                img = ""
    if out:
        return out
    for m in re.finditer(
        r'itemprop=["\']recipeInstructions["\'][^>]*>(.*?)</(?:li|p|div)>',
        html,
        re.I | re.S,
    ):
        block = m.group(1)
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', block, re.I)
        img = urljoin(base_url, unescape(img_m.group(1))) if img_m else ""
        for text in _split_long_step_text(block):
            if text or img:
                out.append({"text": text, "image_url": img})
                img = ""
    return out


def _parse_steps(recipe_ld: dict, html: str, base_url: str = "", description: str = "") -> list[dict]:
    instr = recipe_ld.get("recipeInstructions") or []
    out = []
    for block in instr[:30]:
        if isinstance(block, dict):
            text = block.get("text") or block.get("name") or ""
        else:
            text = str(block)
        text = _clean_step_text(text)
        if text and (not description or text.strip() != description.strip()) and len(text) < 500:
            img = _step_image_url(block)
            if img and base_url:
                img = urljoin(base_url, img)
            out.append({"text": text, "image_url": img})
    html_steps = _parse_steps_from_html(html, base_url)
    desc_norm = (description or "").strip()
    html_steps = [
        s
        for s in html_steps
        if s.get("text") and s["text"].strip() != desc_norm and len(s["text"]) < 500
    ]
    if html_steps and (not out or any(s.get("image_url") for s in html_steps)):
        return html_steps
    if out:
        return out
    return html_steps


def _collect_image_urls(recipe_ld: dict, html: str, base_url: str) -> list[str]:
    urls: list[str] = []
    img = recipe_ld.get("image")
    if isinstance(img, str):
        urls.append(img)
    elif isinstance(img, list):
        for u in img:
            if isinstance(u, str):
                urls.append(u)
            elif isinstance(u, dict) and u.get("url"):
                urls.append(u["url"])
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
    steps = _parse_steps(ld, html, url, description)
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
    base = {
        "title": title[:200],
        "description": description,
        "source_url": url,
        "servings": servings,
        "ingredients": ingredients,
        "steps": steps or [{"text": "Отредактируйте шаги приготовления.", "image_url": ""}],
        "image_urls": image_urls,
        "cuisine_slug": "",
    }
    from .recipe_sites import apply_site_adapter

    return apply_site_adapter(url, html, ld, base)


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


def ingredient_row_to_db(row: dict) -> tuple[str, Decimal, str]:
    name = (row.get("name") or "").strip()[:200]
    amount_raw = row.get("amount")
    unit = (row.get("unit") or "").strip()[:40]
    if amount_raw in (None, "", "0", 0):
        if unit in ("щепотка", "по вкусу", "зубчик"):
            return name, Decimal("0"), unit
        return name, Decimal("0"), ""
    amt = _safe_decimal(amount_raw)
    if amt == 0 and unit:
        return name, Decimal("0"), unit
    if amt == 0 and not unit:
        return name, Decimal("0"), ""
    if not unit:
        unit = "шт."
    return name, amt, unit
