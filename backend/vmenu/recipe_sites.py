"""Site-specific recipe HTML adapters for Russian cooking websites."""

from __future__ import annotations

import json
import re

from urllib.parse import urljoin, urlparse
from html import unescape

from .cuisine_data import detect_cuisine_slug, normalize_cuisine_slug
from .recipe_parser import _normalize_unit, _parse_amount_unit_tail, _parse_ingredient_line, _split_comma_ingredient, strip_html

SitePatch = dict


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def _rows_from_lines(lines: list[str]) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for line in lines:
        row = _parse_ingredient_line(line)
        if isinstance(row, list):
            for item in row:
                if item and item["name"] not in seen:
                    seen.add(item["name"])
                    out.append(item)
        elif row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _split_comma_ingredient(text: str) -> dict | None:
    text = strip_html(text)
    if "," not in text:
        return None
    name, tail = [p.strip() for p in text.rsplit(",", 1)]
    if not name:
        return None
    amount, unit = _parse_amount_unit_tail(tail)
    return {"name": name[:200], "amount": amount, "unit": unit}


def _parse_meta_recipe_ingredients(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'<meta[^>]+itemprop=["\']recipeIngredient["\'][^>]*content=["\']([^"\']+)["\']',
        html,
        re.I,
    ):
        row = _split_comma_ingredient(m.group(1)) or _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    for m in re.finditer(
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+itemprop=["\']recipeIngredient["\']',
        html,
        re.I,
    ):
        row = _split_comma_ingredient(m.group(1)) or _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_russianfood(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'<tr[^>]*class="[^"]*ingr_tr[^"]*"[^>]*>(.*?)</tr>', html, re.I | re.S):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", m.group(1), re.I | re.S)
        if len(cells) >= 2:
            name = strip_html(cells[0])
            tail = strip_html(cells[1])
            line = f"{name} - {tail}" if tail else name
        else:
            line = strip_html(m.group(1))
        row = _parse_ingredient_line(line)
        if row and row["name"] not in seen and len(row["name"]) > 1:
            seen.add(row["name"])
            out.append(row)
    if out:
        return out
    table = re.search(r'<table[^>]*class="[^"]*ingr[^"]*"[^>]*>(.*?)</table>', html, re.I | re.S)
    if table:
        for line in re.split(r"<br\s*/?>|\n|</tr>", table.group(1)):
            row = _parse_ingredient_line(line)
            if row and row["name"] not in seen:
                seen.add(row["name"])
                out.append(row)
    return out


def _parse_povarenok(html: str) -> list[dict]:
    meta = _parse_meta_recipe_ingredients(html)
    if meta:
        return meta
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'class="[^"]*ingredient[^"]*"[^>]*>(.*?)</(?:div|li|tr)>',
        html,
        re.I | re.S,
    ):
        block = m.group(1)
        name_m = re.search(r'class="[^"]*ingredient-name[^"]*"[^>]*>(.*?)</', block, re.I | re.S)
        qty_m = re.search(
            r'class="[^"]*(?:ingredient-amount|squant|value)[^"]*"[^>]*>(.*?)</',
            block,
            re.I | re.S,
        )
        unit_m = re.search(r'class="[^"]*ingredient-unit[^"]*"[^>]*>(.*?)</', block, re.I | re.S)
        if name_m:
            name = strip_html(name_m.group(1))
            amount = strip_html(qty_m.group(1)) if qty_m else ""
            unit = strip_html(unit_m.group(1)) if unit_m else ""
            if amount and unit:
                row = {"name": name[:200], "amount": amount.replace(",", "."), "unit": _normalize_unit(unit) or unit}
            elif amount:
                amt, unt = _parse_amount_unit_tail(amount)
                row = {"name": name[:200], "amount": amt, "unit": unt}
            else:
                row = _parse_ingredient_line(name)
            if isinstance(row, list):
                for item in row:
                    if item and item["name"] not in seen:
                        seen.add(item["name"])
                        out.append(item)
            elif row and row["name"] not in seen:
                seen.add(row["name"])
                out.append(row)
        else:
            line = strip_html(block)
            row = _parse_ingredient_line(line)
            if isinstance(row, list):
                for item in row:
                    if item and item["name"] not in seen:
                        seen.add(item["name"])
                        out.append(item)
            elif row and row["name"] not in seen:
                seen.add(row["name"])
                out.append(row)
    return out


def _parse_povar(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'<a[^>]+rel=["\']ingredient["\'][^>]*>(.*?)</a>\s*(?:<[^>]+>\s*)*([^<]{0,40})',
        html,
        re.I | re.S,
    ):
        name = strip_html(m.group(1))
        tail = strip_html(m.group(2))
        row = _parse_ingredient_line(f"{name} - {tail}" if tail else name)
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_gotovim(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    block = re.search(r'id=["\']ingredients["\'][^>]*>(.*?)</(?:div|table|ul)>', html, re.I | re.S)
    if not block:
        block = re.search(r"Состав.{0,40}</[^>]+>(.*?)</(?:table|ul|div)>", html, re.I | re.S)
    if block:
        for m in re.finditer(r"<li[^>]*>(.*?)</li>", block.group(1), re.I | re.S):
            row = _parse_ingredient_line(m.group(1))
            if row and row["name"] not in seen:
                seen.add(row["name"])
                out.append(row)
    return out


def _parse_gotovim_doma(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'class="[^"]*recipe-ingredient[^"]*"[^>]*>(.*?)</li>',
        html,
        re.I | re.S,
    ):
        block = m.group(1)
        name_m = re.search(r'class="[^"]*name[^"]*"[^>]*>(.*?)</', block, re.I | re.S)
        val_m = re.search(r'class="[^"]*(?:value|amount)[^"]*"[^>]*>(.*?)</', block, re.I | re.S)
        if name_m:
            name = strip_html(name_m.group(1))
            tail = strip_html(val_m.group(1)) if val_m else strip_html(block)
            row = _parse_ingredient_line(f"{name} - {tail}" if tail else name)
        else:
            row = _parse_ingredient_line(block)
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_say7(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'<p[^>]*class="[^"]*ingredient[^"]*"[^>]*>(.*?)</p>', html, re.I | re.S):
        row = _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_edimdoma(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'class="[^"]*Ingredient[^"]*"[^>]*>(.*?)</(?:div|li)>',
        html,
        re.I | re.S,
    ):
        row = _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out or _parse_meta_recipe_ingredients(html)


def _parse_ovkuse_next(html: str) -> SitePatch | None:
    m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    if not m:
        return None
    try:
        pp = json.loads(m.group(1)).get("props", {}).get("pageProps", {})
    except Exception:
        return None
    recipe = pp.get("recipe") or {}
    if not recipe:
        return None
    patch: SitePatch = {}
    title = recipe.get("title") or recipe.get("name")
    if title:
        patch["title"] = str(title).strip()[:200]
    desc = recipe.get("description") or recipe.get("shortDescription")
    if desc:
        patch["description"] = strip_html(str(desc))[:2000]
    ingredients: list[dict] = []
    seen: set[str] = set()
    for block in recipe.get("ingredients") or recipe.get("products") or []:
        if isinstance(block, str):
            row = _split_comma_ingredient(block) or _parse_ingredient_line(block)
        elif isinstance(block, dict):
            name = (block.get("name") or block.get("title") or "").strip()
            amount = str(block.get("amount") or block.get("quantity") or block.get("value") or "").strip()
            unit = str(block.get("unit") or block.get("measure") or "").strip()
            if name and (amount or unit):
                row = {"name": name[:200], "amount": amount, "unit": unit}
            else:
                row = _split_comma_ingredient(name) or _parse_ingredient_line(name)
        else:
            continue
        if row and row["name"] not in seen:
            seen.add(row["name"])
            ingredients.append(row)
    if ingredients:
        patch["ingredients"] = ingredients
    steps_out = []
    for step in recipe.get("steps") or recipe.get("instructions") or []:
        if isinstance(step, str):
            text = strip_html(step)
        elif isinstance(step, dict):
            text = strip_html(step.get("text") or step.get("description") or step.get("name") or "")
        else:
            continue
        if text:
            steps_out.append({"text": text, "image_url": ""})
    if steps_out:
        patch["steps"] = steps_out
    cuisine_raw = recipe.get("kitchen") or recipe.get("cuisine") or recipe.get("nationalKitchen")
    if cuisine_raw:
        patch["cuisine_slug"] = normalize_cuisine_slug(str(cuisine_raw))
    return patch or None


def _parse_kedem(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'<li[^>]*class="[^"]*ingredient[^"]*"[^>]*>(.*?)</li>', html, re.I | re.S):
        row = _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    block = re.search(r'class="[^"]*recipe-ingredients[^"]*"[^>]*>(.*?)</(?:ul|div)>', html, re.I | re.S)
    if block:
        for line in re.split(r"<li[^>]*>|</li>|<br\s*/?>", block.group(1)):
            row = _parse_ingredient_line(line)
            if row and row["name"] not in seen:
                seen.add(row["name"])
                out.append(row)
    return out


def _parse_tveda(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'class="[^"]*(?:ingredient|ingr)[^"]*"[^>]*>(.*?)</(?:li|div|p)>',
        html,
        re.I | re.S,
    ):
        row = _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_namenu(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    block = re.search(r'(?:ингредиент|состав).{0,60}</[^>]+>(.*?)</(?:table|ul|div)>', html, re.I | re.S)
    if block:
        for m in re.finditer(r"<tr[^>]*>(.*?)</tr>", block.group(1), re.I | re.S):
            cells = [strip_html(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", m.group(1), re.I | re.S)]
            cells = [c for c in cells if c]
            if len(cells) >= 2:
                row = _parse_ingredient_line(f"{cells[0]} - {cells[1]}")
            elif cells:
                row = _parse_ingredient_line(cells[0])
            else:
                continue
            if row and row["name"] not in seen:
                seen.add(row["name"])
                out.append(row)
    return out


def _parse_iamcook(html: str) -> list[dict]:
    return _parse_meta_recipe_ingredients(html)


def _parse_kulina(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'<div[^>]*class="[^"]*ingredient[^"]*"[^>]*>(.*?)</div>', html, re.I | re.S):
        row = _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_gastronom_steps(html: str, base_url: str) -> list[dict]:
    out: list[dict] = []
    for m in re.finditer(
        r'itemprop=["\']recipeInstructions["\'][^>]*>(.*?)</(?:ul|ol)>',
        html,
        re.I | re.S,
    ):
        for li in re.finditer(r"<li[^>]*>(.*?)</li>", m.group(1), re.I | re.S):
            inner = li.group(1)
            img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', inner, re.I)
            img = urljoin(base_url, unescape(img_m.group(1))) if img_m else ""
            text = strip_html(re.sub(r"<img[^>]*>", "", inner, flags=re.I))
            text = re.sub(r"^Шаг\s+\d+\s*[:.)-]?\s*", "", text, flags=re.I).strip()
            if text or img:
                out.append({"text": text, "image_url": img})
    if out:
        return out

    markers = list(re.finditer(r"(?:>|^|\s)(?:Шаг|Step)\s*(\d+)", html, re.I))
    if len(markers) > 1:
        for i, m in enumerate(markers):
            start = m.start()
            end = markers[i + 1].start() if i + 1 < len(markers) else min(len(html), start + 12000)
            block = html[start:end]
            img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', block, re.I)
            img = urljoin(base_url, unescape(img_m.group(1))) if img_m else ""
            text = strip_html(re.sub(r"<img[^>]*>", "", block, flags=re.I))
            text = re.sub(r"^(?:Шаг|Step)\s*\d+\s*[:.)-]?\s*", "", text, flags=re.I).strip()
            if text or img:
                out.append({"text": text[:2000], "image_url": img})
        if out:
            return out

    for m in re.finditer(
        r'class="[^"]*(?:recipe-step|cooking-step|instruction|step-item)[^"]*"[^>]*>(.*?)</(?:li|div|article|section|p)>',
        html,
        re.I | re.S,
    ):
        inner = m.group(1)
        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', inner, re.I)
        img = urljoin(base_url, unescape(img_m.group(1))) if img_m else ""
        text = strip_html(re.sub(r"<img[^>]*>", "", inner, flags=re.I))
        if text or img:
            out.append({"text": text, "image_url": img})
    return out


def _parse_gastronom(html: str) -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(
        r'itemprop=["\']recipeIngredient["\'][^>]*>(.*?)</(?:li|p|div|span|td)>',
        html,
        re.I | re.S,
    ):
        line = strip_html(m.group(1))
        line = re.sub(r"\s+", " ", line).strip()
        row = _parse_ingredient_line(line) or _split_comma_ingredient(line)
        if isinstance(row, list):
            for item in row:
                if item and item["name"] not in seen:
                    seen.add(item["name"])
                    out.append(item)
        elif row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    if out:
        return out
    for m in re.finditer(
        r'class="[^"]*(?:ingredient|ingr)[^"]*"[^>]*>(.*?)</(?:li|div|tr|p)>',
        html,
        re.I | re.S,
    ):
        line = strip_html(m.group(1))
        line = re.sub(r"\s+", " ", line).strip()
        if not line or len(line) < 2:
            continue
        row = _parse_ingredient_line(line) or _split_comma_ingredient(line)
        if isinstance(row, list):
            for item in row:
                if item and item["name"] not in seen:
                    seen.add(item["name"])
                    out.append(item)
        elif row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    if out:
        return out
    return _parse_meta_recipe_ingredients(html)


def _parse_hlebopechka(html: str) -> SitePatch | None:
    patch: SitePatch = {}
    title_m = re.search(r'<h1[^>]*class="[^"]*topictitle[^"]*"[^>]*>(.*?)</h1>', html, re.I | re.S)
    if title_m:
        patch["title"] = strip_html(title_m.group(1))[:200]
    body_m = re.search(r'<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)</div>', html, re.I | re.S)
    if not body_m:
        return patch or None
    body = body_m.group(1)
    lines = []
    for m in re.finditer(r"<li[^>]*>(.*?)</li>", body, re.I | re.S):
        t = strip_html(m.group(1))
        if re.search(r"\d", t) and len(t) < 120:
            lines.append(t)
    if not lines:
        for line in re.split(r"<br\s*/?>|\n", strip_html(body)):
            line = line.strip()
            if re.search(r"[-–—]", line) and re.search(r"\d", line) and len(line) < 120:
                lines.append(line)
    if lines:
        patch["ingredients"] = _rows_from_lines(lines[:40])
    steps = []
    for m in re.finditer(r"(?:шаг|этап)\s*\d+[^<\n]{10,400}", body, re.I):
        steps.append({"text": strip_html(m.group(0)), "image_url": ""})
    if steps:
        patch["steps"] = steps[:30]
    return patch or None


def _parse_1000menu(html: str) -> list[dict]:
    rows = _parse_meta_recipe_ingredients(html)
    if rows:
        return rows
    out: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'<div[^>]*class="[^"]*ingredient[^"]*"[^>]*>(.*?)</div>', html, re.I | re.S):
        row = _parse_ingredient_line(m.group(1))
        if row and row["name"] not in seen:
            seen.add(row["name"])
            out.append(row)
    return out


def _parse_eda(html: str, recipe_ld: dict) -> list[dict]:
    raw = recipe_ld.get("recipeIngredient") or []
    out: list[dict] = []
    for line in raw:
        text = str(line)
        row = _split_comma_ingredient(text) or _parse_ingredient_line(text)
        if row:
            out.append(row)
    return out or _parse_meta_recipe_ingredients(html)


_INGREDIENT_PARSERS: dict[str, object] = {
    "russianfood.com": _parse_russianfood,
    "povarenok.ru": _parse_povarenok,
    "povar.ru": _parse_povar,
    "gotovim.ru": _parse_gotovim,
    "gotovim-doma.ru": _parse_gotovim_doma,
    "say7.info": _parse_say7,
    "edimdoma.ru": _parse_edimdoma,
    "kedem.ru": _parse_kedem,
    "tveda.ru": _parse_tveda,
    "namenu.ru": _parse_namenu,
    "iamcook.ru": _parse_iamcook,
    "kulina.ru": _parse_kulina,
    "1000.menu": _parse_1000menu,
    "koolinar.ru": _parse_meta_recipe_ingredients,
    "webspoon.ru": _parse_meta_recipe_ingredients,
    "allrecipes.ru": _parse_meta_recipe_ingredients,
    "eda.ru": _parse_eda,
    "gastronom.ru": _parse_gastronom,
}


def _prefer_ingredients(site_rows: list[dict], base_rows: list[dict]) -> list[dict]:
    if not site_rows:
        return base_rows
    if not base_rows:
        return site_rows
    site_amt = sum(1 for r in site_rows if r.get("amount"))
    base_amt = sum(1 for r in base_rows if r.get("amount"))
    if len(site_rows) > len(base_rows):
        return site_rows
    if len(site_rows) == len(base_rows) and site_amt > base_amt:
        return site_rows
    if len(base_rows) >= 3 and len(site_rows) < max(2, len(base_rows) // 2):
        return base_rows
    return site_rows if site_amt > base_amt else base_rows


def apply_site_adapter(url: str, html: str, recipe_ld: dict, base: dict) -> dict:
    """Merge site-specific fields into parsed recipe dict."""
    domain = _domain(url)
    result = dict(base)
    patch: SitePatch = {}

    if domain == "ovkuse.ru":
        ovk = _parse_ovkuse_next(html)
        if ovk:
            patch.update(ovk)
    elif domain == "hlebopechka.ru":
        hb = _parse_hlebopechka(html)
        if hb:
            patch.update(hb)
    elif domain == "gastronom.ru":
        gastro_steps = _parse_gastronom_steps(html, url)
        if gastro_steps:
            patch["steps"] = gastro_steps
        site_rows = _parse_gastronom(html)
        if site_rows:
            patch["ingredients"] = site_rows

    parser = _INGREDIENT_PARSERS.get(domain)
    if parser:
        if domain == "eda.ru":
            site_rows = _parse_eda(html, recipe_ld)
        else:
            site_rows = parser(html)  # type: ignore[operator]
        merged = _prefer_ingredients(site_rows, result.get("ingredients") or [])
        if merged:
            patch["ingredients"] = merged
    elif not result.get("ingredients"):
        meta_rows = _parse_meta_recipe_ingredients(html)
        if meta_rows:
            patch["ingredients"] = meta_rows

    if not patch.get("cuisine_slug"):
        slug = detect_cuisine_slug(recipe_ld, html, result.get("title", ""), result.get("description", ""))
        if slug:
            patch["cuisine_slug"] = slug

    for key, val in patch.items():
        if val:
            result[key] = val
    return result


SUPPORTED_DOMAINS = sorted(set(_INGREDIENT_PARSERS) | {"ovkuse.ru", "hlebopechka.ru", "gastronom.ru"})
