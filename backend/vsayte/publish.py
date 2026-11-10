"""Render site document to static HTML under VSAYTE_SITES_ROOT/{slug}/."""

from __future__ import annotations

import hashlib
import html
import json
import shutil
from pathlib import Path

from django.conf import settings
from django.utils import timezone

# Keep in sync with frontend/src/vsayte/vsayteSiteCss.js
VSAYTE_INTERACTIVE_CSS = """
.vs-btn{display:inline-block;text-decoration:none;font-weight:600;cursor:pointer;line-height:1.2;transition:transform .15s ease,opacity .15s ease,box-shadow .15s ease,background .15s ease,filter .15s ease,border-color .15s ease,color .15s ease}
.vs-btn[data-hover="lift"]:hover{opacity:.95;transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.14)}
.vs-btn[data-hover="glow"]:hover{box-shadow:0 0 0 4px rgba(255,122,0,.22)}
.vs-btn[data-hover="darken"]:hover{filter:brightness(.9)}
.vs-btn[data-hover="brighten"]:hover{filter:brightness(1.08)}
.vs-btn[data-hover="press"]:hover{transform:translateY(1px);box-shadow:none;opacity:.95}
.vs-btn[data-hover="none"]:hover{transform:none;filter:none}
.vs-btn:focus-visible{outline:2px solid #FF7A00;outline-offset:3px}
.vs-input,.vs-textarea,.vs-select{transition:border-color .15s ease,box-shadow .15s ease}
.vs-input:focus,.vs-textarea:focus,.vs-select:focus{border-color:#FF7A00 !important;box-shadow:0 0 0 3px rgba(255,122,0,.18);outline:none}
.vs-check input{accent-color:#FF7A00}
a[href]:not(.vs-btn){transition:color .15s ease,opacity .15s ease}
a[href]:not(.vs-btn):hover{opacity:.85}
"""


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


def _site_settings(document: dict, site_title: str = "") -> dict:
    meta = document.get("meta") if isinstance(document, dict) else {}
    if not isinstance(meta, dict):
        meta = {}
    site = meta.get("site") if isinstance(meta.get("site"), dict) else {}
    return {
        "name": (site.get("name") or site_title or "").strip(),
        "favicon": (site.get("favicon") or "").strip(),
        "ogImage": (site.get("ogImage") or "").strip(),
        "ogTitle": (site.get("ogTitle") or "").strip(),
        "ogDescription": (site.get("ogDescription") or "").strip(),
        "customCss": (site.get("customCss") or "").strip(),
    }


def _lead_form_script(*, api_base: str, slug: str) -> str:
    """JS: формы .vs-lead-form / [data-vs=lead-form] → POST /vsayte/public/<slug>/leads/."""
    endpoint = f"{api_base.rstrip('/')}/vsayte/public/{slug}/leads/"
    return (
        "<script>(function(){"
        f"var EP={json.dumps(endpoint)};"
        "function bind(f){"
        "if(f.__vsLead)return;f.__vsLead=1;"
        "f.addEventListener('submit',function(ev){"
        "ev.preventDefault();"
        "var st=f.querySelector('.vs-lead-status');"
        "if(st)st.textContent='Отправка…';"
        "var fd=new FormData(f);var payload={};"
        "fd.forEach(function(v,k){payload[k]=String(v||'');});"
        "var body={"
        "name:payload.name||payload.fio||'',"
        "contact:payload.contact||payload.phone||payload.email||payload.tel||'',"
        "message:payload.message||payload.comment||payload.text||'',"
        "page_url:location.href,"
        "payload:payload"
        "};"
        "fetch(EP,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})"
        ".then(function(r){if(!r.ok)throw new Error('fail');"
        "if(st)st.textContent='Спасибо! Заявка отправлена.';f.reset();})"
        ".catch(function(){if(st)st.textContent='Не удалось отправить. Попробуйте позже.';});"
        "});}"
        "document.querySelectorAll('form.vs-lead-form,form[data-vs=\"lead-form\"]').forEach(bind);"
        "})();</script>"
    )


def _wrap_html(
    *,
    title: str,
    body: str,
    css: str,
    global_css: str = "",
    description: str = "",
    site: dict | None = None,
    slug: str = "",
    api_base: str = "",
) -> str:
    site = site or {}
    safe_title = html.escape(title or "Сайт")
    desc = html.escape((description or site.get("ogDescription") or "").strip())
    site_name = html.escape((site.get("name") or "").strip())
    og_title = html.escape((site.get("ogTitle") or title or "").strip())
    og_desc = html.escape((site.get("ogDescription") or description or "").strip())
    favicon = html.escape((site.get("favicon") or "").strip())
    og_image = html.escape((site.get("ogImage") or "").strip())

    tags = [
        '<meta charset="utf-8"/>',
        '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    ]
    if desc:
        tags.append(f'<meta name="description" content="{desc}"/>')
    if favicon:
        tags.append(f'<link rel="icon" href="{favicon}"/>')
    if site_name:
        tags.append(f'<meta property="og:site_name" content="{site_name}"/>')
    if og_title:
        tags.append(f'<meta property="og:title" content="{og_title}"/>')
        tags.append(f'<meta name="twitter:title" content="{og_title}"/>')
    if og_desc:
        tags.append(f'<meta property="og:description" content="{og_desc}"/>')
        tags.append(f'<meta name="twitter:description" content="{og_desc}"/>')
    if og_image:
        tags.append(f'<meta property="og:image" content="{og_image}"/>')
        tags.append('<meta name="twitter:card" content="summary_large_image"/>')
        tags.append(f'<meta name="twitter:image" content="{og_image}"/>')
    tags.append('<meta property="og:type" content="website"/>')
    tags.append(f"<title>{safe_title}</title>")

    head_inner = "\n".join(tags)
    custom_css = (site.get("customCss") or "").strip()
    combined_css = f"{global_css}\n{VSAYTE_INTERACTIVE_CSS}\n{css}\n{custom_css}"
    lead_js = ""
    if slug and api_base:
        lead_js = _lead_form_script(api_base=api_base, slug=slug)
    return (
        "<!DOCTYPE html>\n"
        '<html lang="ru">\n'
        "<head>\n"
        f"{head_inner}\n"
        f"<style>{combined_css}</style>\n"
        "</head>\n"
        f"<body>{body}{lead_js}</body>\n"
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
    site_cfg = _site_settings(document, site.title)
    pages = _page_list(document)
    api_base = getattr(settings, "VSAYTE_API_PUBLIC_BASE", "").rstrip("/")
    hasher = hashlib.sha256()

    for page in pages:
        rel = _safe_relpath(page.get("path") or "/")
        out = root / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        page_title = page.get("seoTitle") or page.get("name") or site.title
        page_desc = page.get("seoDescription") or site_cfg.get("ogDescription") or ""
        content = _wrap_html(
            title=page_title,
            description=page_desc,
            body=page.get("html") or "",
            css=page.get("css") or "",
            global_css=global_css,
            site={
                **site_cfg,
                "ogTitle": page.get("seoTitle") or site_cfg.get("ogTitle") or page_title,
                "ogDescription": page_desc or site_cfg.get("ogDescription") or "",
            },
            slug=site.slug,
            api_base=api_base,
        )
        out.write_text(content, encoding="utf-8")
        hasher.update(content.encode("utf-8"))

    meta = {
        "slug": site.slug,
        "title": site.title,
        "published_at": timezone.now().isoformat(),
        "pages": [p.get("path") or "/" for p in pages],
        "site": site_cfg,
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
