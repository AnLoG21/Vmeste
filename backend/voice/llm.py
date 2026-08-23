"""LLM adapters: YandexGPT → OpenRouter → rule-based fallback."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)

VOICE_TOOLS_SPEC = """
Доступные инструменты (ответ JSON: {"reply": "...", "tool_calls": [{"name": "...", "arguments": {...}}]}):
- list_catalog — услуги и мастера
- match_service(query) — найти услугу по фразе клиента
- match_staff(query, service_id?) — найти мастера по имени
- find_dates(service_id, staff_id?) — свободные даты
- find_windows(service_id, date, staff_id?, staff_fallback?, time_hint?, after_time?) — окна на дату
- create_booking(service_id, starts_at, ends_at, staff_id?, guest_name?) — создать запись (телефон звонящего уже известен)
Правила: не придумывай время — только из find_windows. Если мастер занят — staff_fallback=true.
"""


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group(0))
            except json.JSONDecodeError:
                return None
    return None


def _yandex_gpt(messages: list[dict], system: str) -> str | None:
    folder = (getattr(settings, "YANDEX_CLOUD_FOLDER_ID", "") or "").strip()
    api_key = (getattr(settings, "YANDEX_GPT_API_KEY", "") or "").strip()
    if not folder or not api_key:
        return None
    try:
        import urllib.error
        import urllib.request

        payload = {
            "modelUri": f"gpt://{folder}/yandexgpt-lite/latest",
            "completionOptions": {"stream": False, "temperature": 0.3, "maxTokens": 1200},
            "messages": [{"role": "system", "text": system}] + [
                {"role": m["role"], "text": m["content"]} for m in messages if m.get("content")
            ],
        }
        req = urllib.request.Request(
            "https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Api-Key {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        alts = (data.get("result") or {}).get("alternatives") or []
        if alts:
            return (alts[0].get("message") or {}).get("text") or ""
    except Exception:
        logger.exception("yandex gpt failed")
    return None


def _openrouter(messages: list[dict], system: str) -> str | None:
    key = (getattr(settings, "OPENROUTER_API_KEY", "") or "").strip()
    if not key:
        return None
    try:
        import requests

        proxy = (getattr(settings, "OPENROUTER_HTTP_PROXY", "") or "").strip()
        proxies = {"http": proxy, "https": proxy} if proxy else None
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": getattr(settings, "OPENROUTER_MODEL", "") or "nvidia/nemotron-3-ultra-550b-a55b:free",
                "messages": [{"role": "system", "content": system}] + messages,
                "temperature": 0.3,
            },
            timeout=60,
            proxies=proxies,
        )
        body = resp.json() if resp.content else {}
        return (((body.get("choices") or [{}])[0].get("message") or {}).get("content")) or ""
    except Exception:
        logger.exception("openrouter voice failed")
    return None


def llm_plan_turn(
    *,
    organization_name: str,
    caller_phone: str,
    history: list[dict],
    user_text: str,
    tool_results: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Returns {reply: str, tool_calls: [{name, arguments}]}
    """
    system = (
        f"Ты голосовой администратор салона «{organization_name}». "
        f"Телефон клиента: {caller_phone}. Говори кратко, по-русски, вежливо, для озвучивания по телефону. "
        f"{VOICE_TOOLS_SPEC}"
    )
    messages = list(history)
    messages.append({"role": "user", "content": user_text})
    if tool_results:
        messages.append(
            {
                "role": "user",
                "content": "Результаты инструментов: " + json.dumps(tool_results, ensure_ascii=False),
            }
        )
        messages.append(
            {
                "role": "user",
                "content": "Сформулируй ответ клиенту. Если запись готова — create_booking уже вызван, подтверди детали.",
            }
        )

    raw = _yandex_gpt(messages, system) or _openrouter(messages, system)
    if raw:
        parsed = _extract_json(raw)
        if parsed and isinstance(parsed, dict):
            reply = str(parsed.get("reply") or parsed.get("say") or "").strip()
            tools = parsed.get("tool_calls") or parsed.get("tools") or []
            if isinstance(tools, list):
                return {"reply": reply, "tool_calls": tools}
        return {"reply": raw.strip(), "tool_calls": []}

    return rule_based_plan(user_text, history, tool_results)


def rule_based_plan(
    user_text: str,
    history: list[dict],
    tool_results: list[dict] | None = None,
) -> dict[str, Any]:
    """Minimal offline brain for pilot salons."""
    t = (user_text or "").lower().strip()
    if tool_results:
        for tr in tool_results:
            if tr.get("booking_id"):
                return {
                    "reply": f"Отлично, записала вас. Номер записи {tr['booking_id']}. Ждём вас!",
                    "tool_calls": [],
                }
            wins = tr.get("windows") or []
            if wins:
                w = wins[0]
                label = w.get("staff_label") or "мастер"
                starts = w.get("starts_at", "")[:16].replace("T", " ")
                return {
                    "reply": f"Есть окно {starts}, {label}. Записать вас?",
                    "tool_calls": [],
                    "pending_booking": w,
                }
            if tr.get("service") is None and "match_service" in str(tr):
                return {"reply": "Подскажите, на какую услугу хотите записаться?", "tool_calls": []}

    if any(x in t for x in ("оператор", "админ", "человек", "живой")):
        return {"reply": "Сейчас соединю с администратором.", "tool_calls": [], "transfer": True}

    if any(x in t for x in ("да", "подтвер", "запис", "давай", "ок", "хорошо")) and not any(
        x in t for x in ("не", "нет")
    ):
        # try infer intent from full conversation
        full = " ".join(m.get("content", "") for m in history if m.get("role") == "user") + " " + t
        tool_calls = [{"name": "match_service", "arguments": {"query": full}}]
        return {"reply": "", "tool_calls": tool_calls}

    if any(x in t for x in ("маник", "ногот", "стриж", "бров", "ресниц", "педик", "окраш", "завтра", "сегодня")):
        tool_calls = [
            {"name": "match_service", "arguments": {"query": t}},
        ]
        return {"reply": "", "tool_calls": tool_calls}

    if not history:
        return {
            "reply": "Здравствуйте! Помогу записаться. Скажите услугу, мастера и удобное время.",
            "tool_calls": [],
        }

    return {
        "reply": "Уточните, пожалуйста: услуга, мастер, день и время. Например: маникюр завтра после шести.",
        "tool_calls": [{"name": "list_catalog", "arguments": {}}],
    }
