"""Best-effort recipe import from external URLs (title, description, ingredients)."""

from __future__ import annotations

import json
import re
from html import unescape
from urllib.parse import urlparse
from urllib.request import Request, urlopen

_USER_AGENT = "VmesteVmenuBot/1.0 (+https://vsevmeste.space)"


def _fetch_html(url: str, timeout: int = 12) -> str:
    req = Request(url, headers={"User-Agent": _USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(req, timeout=timeout) as resp:
        raw = resp.read(200_000)
    for enc in ("utf-8", "cp1251", "latin-1"):
        try:
            return raw.decode(enc)
        except Exception:
            continue
    return raw.decode("utf-8", errors="replace")


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


def _parse_ingredients(recipe_ld: dict) -> list[dict]:
    raw = recipe_ld.get("recipeIngredient") or recipe_ld.get("ingredients") or []
    out = []
    for line in raw[:40]:
        text = str(line).strip()
        if not text:
            continue
        m = re.match(r"^([\d.,]+)\s*([а-яa-z.%]+)?\s*(.+)$", text, re.I)
        if m:
            amount = m.group(1).replace(",", ".")
            unit = (m.group(2) or "г").strip()
            name = m.group(3).strip()
        else:
            amount, unit, name = "1", "шт.", text
        out.append({"name": name[:200], "amount": amount, "unit": unit[:40]})
    return out


def _parse_steps(recipe_ld: dict) -> list[dict]:
    instr = recipe_ld.get("recipeInstructions") or []
    out = []
    for block in instr[:30]:
        if isinstance(block, dict):
            text = (block.get("text") or "").strip()
        else:
            text = str(block).strip()
        if text:
            out.append({"text": text})
    return out


def parse_recipe_url(url: str) -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Нужна ссылка http или https")
    html = _fetch_html(url)
    ld = _json_ld_recipe(html)
    title = (ld.get("name") or _meta(html, "og:title") or _title_tag(html) or "Импортированный рецепт").strip()
    description = (
        ld.get("description") or _meta(html, "og:description") or _meta(html, "description") or ""
    ).strip()[:2000]
    ingredients = _parse_ingredients(ld)
    steps = _parse_steps(ld)
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
    }
