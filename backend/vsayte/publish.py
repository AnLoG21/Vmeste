"""Render site document to static HTML under VSAYTE_SITES_ROOT/{slug}/."""

from __future__ import annotations

import hashlib
import html
import json
import shutil
from pathlib import Path

from django.conf import settings
from django.utils import timezone


def sites_root() -> Path:
    root = getattr(settings, "VSAYTE_SITES_ROOT", None)
    if root:
        return Path(root)
    return Path(settings.MEDIA_ROOT) / "vsayte-sites"


def _page_list(document: dict) -> list[dict]:
    if not isinstance(document, dict):
        return []
    pages = document.get("pages")
    if isinstance(pages, list) and pages:
        return pages
    # Single-page grapesjs export
    return [
        {
            "id": "home",
            "name": "Главная",
            "path": "/",
            "html": document.get("html") or "",
            "css": document.get("css") or "",
        }
    ]


def _safe_relpath(page_path: str) -> str:
    p = (page_path or "/").strip() or "/"
    if not p.startswith("/"):
        p = "/" + p
    p = p.split("?")[0].split("#")[0]
    if p.endswith("/") and p != "/":
        p = p[:-1]
    if p == "/":
        return "index.html"
    rel = p.lstrip("/").replace("..", "")
    if not rel.endswith(".html"):
        rel = f"{rel}/index.html"
    return rel


def _wrap_html(*, title: str, body: str, css: str, global_css: str = "") -> str:
    safe_title = html.escape(title or "Сайт")
    return (
        "<!DOCTYPE html>\n"
        '<html lang="ru">\n'
        "<head>\n"
        '<meta charset="utf-8"/>\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>\n'
        f"<title>{safe_title}</title>\n"
        f"<style>{global_css}\n{css}</style>\n"
        "</head>\n"
        f"<body>{body}</body>\n"
        "</html>\n"
    )


def publish_site(site) -> tuple[str, str]:
    """Write static files. Returns (storage_path, checksum)."""
    root = sites_root() / site.slug
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True, exist_ok=True)

    document = site.document or {}
    global_css = document.get("css") or ""
    pages = _page_list(document)
    hasher = hashlib.sha256()

    for page in pages:
        rel = _safe_relpath(page.get("path") or "/")
        out = root / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        content = _wrap_html(
            title=page.get("name") or site.title,
            body=page.get("html") or "",
            css=page.get("css") or "",
            global_css=global_css,
        )
        out.write_text(content, encoding="utf-8")
        hasher.update(content.encode("utf-8"))

    meta = {
        "slug": site.slug,
        "title": site.title,
        "published_at": timezone.now().isoformat(),
        "pages": [p.get("path") or "/" for p in pages],
    }
    meta_path = root / "_meta.json"
    meta_json = json.dumps(meta, ensure_ascii=False, indent=2)
    meta_path.write_text(meta_json, encoding="utf-8")
    hasher.update(meta_json.encode("utf-8"))

    return str(root), hasher.hexdigest()


def unpublish_site(site) -> None:
    root = sites_root() / site.slug
    if root.exists():
        shutil.rmtree(root)
