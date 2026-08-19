"""HTTP-клиент Ozon Seller API и Wildberries API."""

from __future__ import annotations

import logging
from typing import Any

import requests

from .models import MarketplaceApiLog, MarketplaceSettings

logger = logging.getLogger(__name__)
TIMEOUT = 30

OZON_BASE = "https://api-seller.ozon.ru"
WB_CONTENT = "https://content-api.wildberries.ru"
WB_MARKETPLACE = "https://marketplace-api.wildberries.ru"
WB_PRICES = "https://discounts-prices-api.wildberries.ru"
WB_STATS = "https://statistics-api.wildberries.ru"
WB_FEEDBACKS = "https://feedbacks-api.wildberries.ru"


class MarketplaceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _log(provider, marketplace: str, method: str, endpoint: str, status_code: int | None, error: str = ""):
    try:
        MarketplaceApiLog.objects.create(
            provider=provider,
            marketplace=marketplace,
            endpoint=endpoint[:255],
            method=method,
            status_code=status_code,
            error_message=(error or "")[:2000],
        )
    except Exception:
        logger.exception("marketplace api log failed")


def ozon_headers(settings: MarketplaceSettings) -> dict[str, str]:
    if not settings.has_ozon():
        raise MarketplaceError("Не указаны ключи Ozon (Client ID и API Key).")
    return {
        "Client-Id": settings.ozon_client_id.strip(),
        "Api-Key": settings.ozon_api_key.strip(),
        "Content-Type": "application/json",
    }


def wb_headers(settings: MarketplaceSettings) -> dict[str, str]:
    if not settings.has_wb():
        raise MarketplaceError("Не указан API-ключ Wildberries.")
    return {
        "Authorization": settings.wb_api_key.strip(),
        "Content-Type": "application/json",
    }


def request_json(
    *,
    provider,
    marketplace: str,
    method: str,
    url: str,
    headers: dict,
    json_body: Any = None,
    params: dict | None = None,
) -> dict:
    try:
        resp = requests.request(
            method,
            url,
            headers=headers,
            json=json_body,
            params=params,
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        _log(provider, marketplace, method, url, None, str(exc))
        raise MarketplaceError(f"Не удалось связаться с {marketplace}: {exc}", 502) from exc
    text = (resp.text or "")[:4000]
    _log(provider, marketplace, method, url, resp.status_code, "" if resp.ok else text)
    try:
        data = resp.json() if resp.content else {}
    except ValueError:
        data = {"raw": text}
    if not resp.ok:
        detail = data.get("message") or data.get("detail") or data.get("error") or text or resp.reason
        raise MarketplaceError(str(detail)[:800], resp.status_code)
    if not isinstance(data, dict):
        return {"result": data}
    return data


def normalize_marketplace_images(product: dict) -> list[str]:
    """Absolute public URLs for Ozon/WB (prefer disk/public_url over local preview paths)."""
    urls: list[str] = []
    seen: set[str] = set()
    for raw in list(product.get("images") or []) + list(product.get("wb_images") or []):
        if isinstance(raw, dict):
            u = str(raw.get("public_url") or raw.get("disk_url") or raw.get("url") or "").strip()
        else:
            u = str(raw or "").strip()
        if not u or u in seen:
            continue
        if not (u.startswith("http://") or u.startswith("https://")):
            continue
        urls.append(u)
        seen.add(u)
    return urls


def build_ozon_item(product: dict) -> dict:
    images = normalize_marketplace_images(product)
    item = {
        "offer_id": str(product.get("offer_id") or "").strip(),
        "name": str(product.get("name") or "").strip(),
        "price": str(product.get("price") or "0"),
        "vat": "0",
        "description": product.get("description") or "",
        "images": images,
        "currency_code": "RUB",
    }
    if product.get("barcode"):
        item["barcode"] = str(product["barcode"])
    if product.get("category"):
        item["description_category_id"] = int(product["category"])
    if product.get("type"):
        item["type_id"] = int(product["type"])
    chars = product.get("characteristics") or {}
    if isinstance(chars, dict) and chars:
        item["attributes"] = [
            {"id": int(k), "values": [{"value": str(v)}]} for k, v in chars.items() if v not in (None, "")
        ]
    if product.get("stock") is not None:
        item["stocks"] = {"stocks": [{"stock": int(product.get("stock") or 0)}]}
    return item


def build_wb_card(product: dict) -> dict:
    price_kop = int(round(float(product.get("price") or 0) * 100))
    variant = {
        "vendorCode": str(product.get("offer_id") or product.get("wb_sku") or "").strip(),
        "title": str(product.get("name") or "").strip(),
        "description": product.get("description") or "",
        "brand": product.get("brand") or "",
        "sizes": [{"price": price_kop, "skus": [str(product.get("barcode") or product.get("offer_id") or "")]}],
    }
    images = normalize_marketplace_images(product)
    if images:
        variant["mediaFiles"] = list(images)
    chars = product.get("characteristics") or {}
    if isinstance(chars, dict) and chars:
        variant["characteristics"] = [{"id": int(k), "value": [str(v)]} for k, v in chars.items() if v not in (None, "")]
    card = {"variants": [variant]}
    if product.get("category"):
        card["subjectID"] = int(product["category"])
    return card


def parse_ozon_product_item(item: dict) -> dict:
    """Map Ozon product info item to cabinet product form."""
    if not isinstance(item, dict):
        return {}
    attrs: dict[str, str] = {}
    for row in item.get("attributes") or []:
        if not isinstance(row, dict):
            continue
        aid = row.get("id") or row.get("attribute_id")
        values = row.get("values") or []
        if not aid or not values:
            continue
        first = values[0]
        val = first.get("value") if isinstance(first, dict) else first
        if val not in (None, ""):
            attrs[str(aid)] = str(val)

    image_urls: list[str] = []
    for raw in item.get("images") or []:
        if isinstance(raw, str) and raw.strip():
            image_urls.append(raw.strip())
        elif isinstance(raw, dict) and raw.get("url"):
            image_urls.append(str(raw["url"]))
    primary = item.get("primary_image")
    if isinstance(primary, str) and primary.strip() and primary not in image_urls:
        image_urls.insert(0, primary.strip())

    images = [{"url": u, "public_url": u} for u in image_urls]
    price = item.get("price") or item.get("marketing_price") or item.get("min_price") or ""
    stock = 0
    stocks = item.get("stocks") or {}
    if isinstance(stocks, dict):
        for row in stocks.get("stocks") or []:
            if isinstance(row, dict):
                stock = max(stock, int(row.get("present") or row.get("stock") or 0))

    return {
        "offer_id": str(item.get("offer_id") or "").strip(),
        "name": str(item.get("name") or "").strip(),
        "brand": str(item.get("brand") or item.get("brand_name") or "").strip(),
        "price": str(price or ""),
        "stock": stock,
        "description": str(item.get("description") or item.get("description_html") or "").strip(),
        "barcode": str(item.get("barcode") or "").strip(),
        "category": str(item.get("description_category_id") or item.get("category_id") or ""),
        "type": str(item.get("type_id") or ""),
        "characteristics": attrs,
        "images": images,
        "product_id": item.get("product_id") or item.get("id"),
    }


def summarize_ozon_import_status(data: dict) -> dict:
    """Human-readable Ozon import task status."""
    result = data.get("result") if isinstance(data, dict) else {}
    if not isinstance(result, dict):
        result = data if isinstance(data, dict) else {}
    items = result.get("items") or []
    rows = []
    overall = "pending"
    for item in items:
        if not isinstance(item, dict):
            continue
        status = str(item.get("status") or "unknown").lower()
        errors = item.get("errors") or []
        err_text = ""
        if errors:
            err_text = "; ".join(
                str(e.get("message") or e.get("code") or e) if isinstance(e, dict) else str(e) for e in errors[:3]
            )
        rows.append(
            {
                "offer_id": item.get("offer_id") or "",
                "product_id": item.get("product_id"),
                "status": status,
                "errors": err_text,
            }
        )
        if status in ("failed", "error"):
            overall = "failed"
        elif status in ("imported", "success", "done") and overall != "failed":
            overall = "success"
    if not rows:
        overall = str(result.get("status") or "pending").lower()
    return {"status": overall, "items": rows, "raw": data}


OZON_ACTIONS = {
    "categories.tree": ("POST", f"{OZON_BASE}/v1/description-category/tree"),
    "categories.attributes": ("POST", f"{OZON_BASE}/v1/description-category/attribute"),
    "barcode.add": ("POST", f"{OZON_BASE}/v1/barcode/add"),
    "barcode.generate": ("POST", f"{OZON_BASE}/v1/barcode/generate"),
    "products.import": ("POST", f"{OZON_BASE}/v3/product/import"),
    "products.import_info": ("POST", f"{OZON_BASE}/v1/product/import/info"),
    "products.list": ("POST", f"{OZON_BASE}/v3/product/list"),
    "products.info": ("POST", f"{OZON_BASE}/v3/product/info/list"),
    "products.delete": ("POST", f"{OZON_BASE}/v1/product/archive"),
    "products.prices": ("POST", f"{OZON_BASE}/v1/product/import/prices"),
    "products.stocks": ("POST", f"{OZON_BASE}/v2/products/stocks"),
    "products.stocks_info": ("POST", f"{OZON_BASE}/v4/product/info/stocks"),
    "orders.list": ("POST", f"{OZON_BASE}/v3/posting/fbs/list"),
    "orders.info": ("POST", f"{OZON_BASE}/v3/posting/fbs/get"),
    "orders.cancel": ("POST", f"{OZON_BASE}/v3/posting/fbs/cancel"),
    "orders.ship": ("POST", f"{OZON_BASE}/v3/posting/fbs/ship"),
    "analytics.data": ("POST", f"{OZON_BASE}/v1/analytics/data"),
    "analytics.stocks": ("POST", f"{OZON_BASE}/v1/analytics/stock_on_warehouses"),
    "finance.list": ("POST", f"{OZON_BASE}/v3/finance/transaction/list"),
    "warehouses.list": ("POST", f"{OZON_BASE}/v1/warehouse/list"),
    "actions.list": ("GET", f"{OZON_BASE}/v1/actions"),
    "reviews.list": ("POST", f"{OZON_BASE}/v1/review/list"),
    "reviews.answer": ("POST", f"{OZON_BASE}/v1/review/comment/create"),
}

WB_ACTIONS = {
    "categories.parents": ("GET", f"{WB_CONTENT}/content/v2/object/parent/all"),
    "categories.subjects": ("GET", f"{WB_CONTENT}/content/v2/object/all"),
    "categories.charcs": ("GET", f"{WB_CONTENT}/content/v2/object/charcs/{{subject_id}}"),
    "barcode.generate": ("POST", f"{WB_CONTENT}/content/v2/barcodes"),
    "products.upload": ("POST", f"{WB_CONTENT}/content/v2/cards/upload"),
    "products.list": ("POST", f"{WB_CONTENT}/content/v2/get/cards/list"),
    "products.filter": ("POST", f"{WB_CONTENT}/content/v2/get/cards/list"),
    "products.delete": ("POST", f"{WB_CONTENT}/content/v2/cards/delete/trash"),
    "products.prices": ("POST", f"{WB_PRICES}/api/v2/upload/task"),
    "products.stocks": ("PUT", f"{WB_MARKETPLACE}/api/v3/stocks/{{warehouseId}}"),
    "orders.list": ("GET", f"{WB_MARKETPLACE}/api/v3/orders/new"),
    "orders.info": ("GET", f"{WB_MARKETPLACE}/api/v3/orders/{{id}}"),
    "orders.cancel": ("PATCH", f"{WB_MARKETPLACE}/api/v3/orders/{{id}}/cancel"),
    "analytics.sales": ("GET", f"{WB_STATS}/api/v1/supplier/reportDetailByPeriod"),
    "analytics.stocks": ("GET", f"{WB_STATS}/api/v1/supplier/stocks"),
    "analytics.payments": ("GET", f"{WB_STATS}/api/v1/supplier/sales"),
    "warehouses.list": ("GET", f"{WB_MARKETPLACE}/api/v3/warehouses"),
    "questions.list": ("GET", f"{WB_FEEDBACKS}/api/v1/questions"),
    "questions.answer": ("PATCH", f"{WB_FEEDBACKS}/api/v1/questions"),
    "feedbacks.list": ("GET", f"{WB_FEEDBACKS}/api/v1/feedbacks"),
    "feedbacks.answer": ("PATCH", f"{WB_FEEDBACKS}/api/v1/feedbacks"),
    "supplies.list": ("GET", f"{WB_MARKETPLACE}/api/v3/supplies"),
    "supplies.create": ("POST", f"{WB_MARKETPLACE}/api/v3/supplies"),
    "supplies.close": ("PATCH", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}/close"),
}


def resolve_url(template: str, extra: dict) -> str:
    url = template
    for key, val in (extra or {}).items():
        url = url.replace("{" + str(key) + "}", str(val))
        url = url.replace("{{" + str(key) + "}}", str(val))
    return url
