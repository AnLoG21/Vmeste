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


def humanize_api_error(detail: str, status_code: int | None = None) -> str:
    """Translate raw Ozon/WB API errors into short Russian hints."""
    text = str(detail or "").strip()
    low = text.lower()
    code = int(status_code or 0)
    if "obsolete method" in low or "method is deprecated" in low:
        return "Метод API устарел. Обновите кабинет — используется актуальный endpoint."
    if code == 429 or "rate limit" in low or "max rate" in low or "too many requests" in low:
        return "Слишком частые запросы к площадке (лимит ~2/сек). Подождите пару секунд и повторите."
    if (
        "permissiondenied" in low
        or "permission denied" in low
        or "not available with existing subscription" in low
        or ("subscription" in low and ("not available" in low or "rpc error" in low))
    ):
        return (
            "Раздел недоступен на текущем тарифе кабинета продавца (часто отзывы Premium). "
            "Проверьте подписку в личном кабинете Ozon/WB."
        )
    if "invalid google.protobuf.timestamp" in low:
        return "Неверный формат даты для API. Обновите кабинет и повторите."
    if "invalid value for string field last_id" in low:
        return "Неверный параметр пагинации отзывов. Обновите кабинет и повторите."
    if code == 401 or "unauthorized" in low or "invalid api key" in low or "api-key" in low:
        return "Ключ API отклонён. Проверьте Client ID / API Key в Управлении и боевой режим."
    if code == 403 or "forbidden" in low:
        return "Нет доступа к методу API. Проверьте права ключа и тариф площадки."
    if "sku" in low or "barcode" in low or "штрихкод" in low:
        return (
            "Остатки WB принимают sku = штрихкод карточки, не артикул. "
            "Укажите barcode в карточке или в таблице остатков."
        )
    if "warehouse" in low or "склад" in low:
        return "Неверный склад. Проверьте ID склада в Управлении и повторите."
    if "nmid" in low or "nm_id" in low or "nm id" in low:
        return "Неверный nmID Wildberries. Подставьте nmID из истории карточек."
    if code >= 500:
        return f"Площадка временно недоступна ({code}). Повторите позже."
    # Prefer the useful tail of protobuf-style messages
    if "desc =" in text:
        try:
            text = text.split("desc =", 1)[1].strip()
        except Exception:
            pass
    return (text or "Ошибка площадки")[:800]


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
        raise MarketplaceError(humanize_api_error(str(detail), resp.status_code), resp.status_code)
    if not isinstance(data, dict):
        return {"result": data}
    return data


def request_bytes(
    *,
    provider,
    marketplace: str,
    method: str,
    url: str,
    headers: dict,
    json_body: Any = None,
) -> tuple[bytes, str]:
    """Binary response (e.g. PDF labels). Returns (content, content_type)."""
    try:
        resp = requests.request(
            method,
            url,
            headers=headers,
            json=json_body,
            timeout=TIMEOUT,
        )
    except requests.RequestException as exc:
        _log(provider, marketplace, method, url, None, str(exc))
        raise MarketplaceError(f"Не удалось связаться с {marketplace}: {exc}", 502) from exc
    ctype = (resp.headers.get("Content-Type") or "application/octet-stream").split(";")[0].strip()
    if not resp.ok:
        text = (resp.text or "")[:800]
        _log(provider, marketplace, method, url, resp.status_code, text)
        try:
            data = resp.json() if resp.content else {}
        except ValueError:
            data = {}
        detail = data.get("message") or data.get("detail") or data.get("error") or text or resp.reason
        raise MarketplaceError(humanize_api_error(str(detail), resp.status_code), resp.status_code)
    _log(provider, marketplace, method, url, resp.status_code, "")
    return resp.content or b"", ctype


def generate_local_ean13(count: int = 1) -> list[str]:
    """Internal EAN-13 (prefix 200) for new cards before they exist on Ozon."""
    import random

    out: list[str] = []
    n = max(1, min(int(count or 1), 20))
    for _ in range(n):
        body = "200" + "".join(str(random.randint(0, 9)) for _ in range(9))
        digits = [int(c) for c in body]
        checksum = (10 - (sum(digits[i] * (3 if i % 2 else 1) for i in range(12)) % 10)) % 10
        out.append(body + str(checksum))
    return out


def normalize_marketplace_images(product: dict) -> list[str]:
    """Absolute public HTTPS URLs for Ozon/WB photos (skip video items)."""
    urls: list[str] = []
    seen: set[str] = set()
    for raw in list(product.get("images") or []) + list(product.get("wb_images") or []):
        if isinstance(raw, dict):
            kind = str(raw.get("kind") or "").lower()
            name = str(raw.get("name") or raw.get("url") or "").lower()
            if kind == "video" or name.endswith((".webm", ".mp4", ".mov", ".m4v")):
                continue
            u = str(raw.get("public_url") or raw.get("disk_url") or raw.get("url") or "").strip()
        else:
            u = str(raw or "").strip()
            if u.lower().endswith((".webm", ".mp4", ".mov", ".m4v")):
                continue
        if not u or u in seen:
            continue
        if not (u.startswith("http://") or u.startswith("https://")):
            continue
        urls.append(u)
        seen.add(u)
    return urls


def normalize_marketplace_videos(product: dict) -> list[str]:
    """Public HTTPS video URLs from product media."""
    urls: list[str] = []
    seen: set[str] = set()
    for raw in list(product.get("images") or []) + list(product.get("videos") or []):
        if isinstance(raw, dict):
            kind = str(raw.get("kind") or "").lower()
            name = str(raw.get("name") or raw.get("url") or "").lower()
            is_video = kind == "video" or any(name.endswith(ext) for ext in (".webm", ".mp4", ".mov", ".m4v"))
            if not is_video:
                continue
            u = str(raw.get("public_url") or raw.get("disk_url") or raw.get("url") or "").strip()
        else:
            u = str(raw or "").strip()
            if not any(u.lower().endswith(ext) for ext in (".webm", ".mp4", ".mov", ".m4v")):
                continue
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
    meta = product.get("characteristics_meta") or {}
    if isinstance(chars, dict) and chars:
        attrs = []
        for k, v in chars.items():
            if v in (None, ""):
                continue
            m = meta.get(str(k)) or {}
            if m.get("dictionary"):
                try:
                    attrs.append({"id": int(k), "values": [{"dictionary_value_id": int(v)}]})
                except (TypeError, ValueError):
                    attrs.append({"id": int(k), "values": [{"value": str(v)}]})
            else:
                attrs.append({"id": int(k), "values": [{"value": str(v)}]})
        if attrs:
            item["attributes"] = attrs
    videos = normalize_marketplace_videos(product)
    if videos:
        # Ozon video via complex_attributes: link 21841 + name 21837
        item["complex_attributes"] = [
            {
                "attributes": [
                    {
                        "complex_id": 100001,
                        "id": 21841,
                        "values": [{"value": u} for u in videos],
                    },
                    {
                        "complex_id": 100001,
                        "id": 21837,
                        "values": [{"value": f"video_{i + 1}"} for i, _ in enumerate(videos)],
                    },
                ]
            }
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
        "vendor_code": str(item.get("offer_id") or item.get("vendor_code") or "").strip(),
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
        "nm_id": item.get("sku") or item.get("nm_id"),
    }


def normalize_product_identifiers(product: dict, marketplace: str) -> dict:
    """Ensure vendor_code / nm_id / product_id are stored in product_data."""
    data = dict(product or {})
    offer_id = str(data.get("offer_id") or data.get("wb_sku") or data.get("vendor_code") or "").strip()
    if offer_id:
        data["offer_id"] = offer_id
    if marketplace == "wildberries":
        data["vendor_code"] = str(data.get("vendor_code") or offer_id).strip()
        nm = data.get("nm_id") or data.get("nmID") or data.get("nmId")
        if nm not in (None, ""):
            data["nm_id"] = int(nm) if str(nm).isdigit() else nm
    else:
        pid = data.get("product_id") or data.get("ozon_product_id")
        if pid not in (None, ""):
            data["product_id"] = int(pid) if str(pid).isdigit() else pid
    return data


def validate_product_for_import(product: dict, marketplace: str) -> list[str]:
    errors: list[str] = []
    offer_id = str(product.get("offer_id") or product.get("wb_sku") or "").strip()
    name = str(product.get("name") or "").strip()
    if not offer_id:
        errors.append("Укажите артикул.")
    if not name:
        errors.append("Укажите название.")
    if marketplace == "wildberries":
        if not str(product.get("category") or "").strip():
            errors.append("Выберите предмет Wildberries.")
    else:
        if not str(product.get("category") or "").strip():
            errors.append("Выберите категорию Ozon.")
        if not str(product.get("type") or "").strip():
            errors.append("Выберите тип товара Ozon.")
    req_ids = product.get("required_attributes") or []
    chars = product.get("characteristics") or {}
    names = product.get("required_attribute_names") or {}
    if isinstance(req_ids, list):
        for aid in req_ids:
            key = str(aid)
            val = chars.get(key) if isinstance(chars, dict) else None
            if val is None and isinstance(chars, dict):
                val = chars.get(aid)
            if val is None or str(val).strip() == "":
                label = names.get(key) or names.get(str(aid)) or key
                errors.append(f"Заполните обязательную характеристику «{label}».")
    if not normalize_marketplace_images(product):
        errors.append("Добавьте хотя бы одно фото с публичным URL.")
    return errors


def fetch_wb_nm_id(provider, settings_obj: MarketplaceSettings, vendor_code: str) -> int | None:
    vendor_code = (vendor_code or "").strip()
    if not vendor_code:
        return None
    try:
        resp = request_json(
            provider=provider,
            marketplace="wb",
            method="POST",
            url=WB_ACTIONS["products.list"][1],
            headers=wb_headers(settings_obj),
            json_body={
                "settings": {
                    "cursor": {"limit": 50},
                    "filter": {"textSearch": vendor_code, "withPhoto": -1},
                }
            },
        )
    except MarketplaceError:
        return None
    cards = resp.get("cards") or (resp.get("data") or {}).get("cards") or []
    for card in cards:
        if not isinstance(card, dict):
            continue
        variant = (card.get("variants") or [{}])[0]
        vc = str(variant.get("vendorCode") or card.get("vendorCode") or "").strip()
        if vc == vendor_code:
            nm = card.get("nmID") or card.get("nmId")
            if nm is not None:
                try:
                    return int(nm)
                except (TypeError, ValueError):
                    return None
    return None


def apply_import_identifiers_to_history(hist, marketplace: str, summary_items: list | None = None, nm_id=None) -> None:
    pdata = dict(hist.product_data or {})
    if marketplace == "wildberries":
        pdata["vendor_code"] = str(pdata.get("vendor_code") or hist.offer_id or "").strip()
        if nm_id is not None:
            pdata["nm_id"] = nm_id
    elif summary_items:
        for item in summary_items:
            if not isinstance(item, dict):
                continue
            if str(item.get("offer_id") or "") == str(hist.offer_id) and item.get("product_id") is not None:
                pdata["product_id"] = item.get("product_id")
                break
    hist.product_data = normalize_product_identifiers(pdata, marketplace)
    hist.save(update_fields=["product_data"])


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
    "categories.attribute_values": ("POST", f"{OZON_BASE}/v1/description-category/attribute/values"),
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
    "orders.label": ("POST", f"{OZON_BASE}/v2/posting/fbs/package-label"),
    "analytics.data": ("POST", f"{OZON_BASE}/v1/analytics/data"),
    "analytics.stocks": ("POST", f"{OZON_BASE}/v1/analytics/stock_on_warehouses"),
    "finance.list": ("POST", f"{OZON_BASE}/v3/finance/transaction/list"),
    "warehouses.list": ("POST", f"{OZON_BASE}/v2/warehouse/list"),
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
    "supplies.get": ("GET", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}"),
    "supplies.orders": ("GET", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}/orders"),
    "supplies.add_order": ("PATCH", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}/orders/{{orderId}}"),
    "supplies.deliver": ("PATCH", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}/deliver"),
    "supplies.delete": ("DELETE", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}"),
    # alias kept for older UI calls
    "supplies.close": ("PATCH", f"{WB_MARKETPLACE}/api/v3/supplies/{{id}}/deliver"),
}


def resolve_url(template: str, extra: dict) -> str:
    url = template
    for key, val in (extra or {}).items():
        url = url.replace("{" + str(key) + "}", str(val))
        url = url.replace("{{" + str(key) + "}}", str(val))
    return url
