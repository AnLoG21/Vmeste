"""Mango Office VPBX API (callback / outbound)."""

from __future__ import annotations

import hashlib
import json
import logging
import uuid
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

MANGO_CALLBACK_URL = "https://app.mango-office.ru/vpbx/commands/callback"


def _sign(api_key: str, api_salt: str, payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(f"{api_key}{raw}{api_salt}".encode("utf-8")).hexdigest()


def mango_callback(
    *,
    api_key: str,
    api_salt: str,
    to_number: str,
    line_number: str,
    from_extension: str = "",
    command_id: str | None = None,
) -> dict:
    """
    Initiate outbound call. Returns {ok, command_id, raw} or {ok: False, error}.
    """
    key = (api_key or "").strip()
    salt = (api_salt or "").strip()
    to = "".join(ch for ch in str(to_number) if ch.isdigit())
    line = "".join(ch for ch in str(line_number) if ch.isdigit())
    if not key or not salt or len(to) < 10 or not line:
        return {"ok": False, "error": "Укажите ключи Mango, линию и номер клиента."}

    cid = command_id or str(uuid.uuid4())
    payload: dict = {
        "command_id": cid,
        "to_number": to,
        "line_number": line,
    }
    ext = (from_extension or "").strip()
    if ext:
        payload["from"] = {"extension": ext}

    json_str = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    sign = _sign(key, salt, payload)
    body = urllib.parse.urlencode(
        {"vpbx_api_key": key, "sign": sign, "json": json_str}
    ).encode("utf-8")
    req = urllib.request.Request(MANGO_CALLBACK_URL, data=body, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            text = resp.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(text) if text else {}
        except json.JSONDecodeError:
            data = {"raw": text}
        result = data.get("result") if isinstance(data, dict) else None
        ok = str(result) == "1000"
        if not ok and isinstance(data, dict) and not data.get("result"):
            ok = True
        return {"ok": ok, "command_id": cid, "raw": data}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("Mango callback HTTP %s: %s", e.code, body)
        return {"ok": False, "error": body or str(e), "command_id": cid}
    except Exception as e:
        logger.exception("Mango callback failed")
        return {"ok": False, "error": str(e), "command_id": cid}
