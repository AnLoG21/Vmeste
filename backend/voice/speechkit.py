"""Yandex SpeechKit TTS/STT for voice webhook responses."""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

TTS_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"
STT_URL = "https://stt.api.cloud.yandex.net/speech/v1/stt:recognize"
MAX_TTS_CHARS = 480


def speechkit_ready() -> bool:
    return bool((getattr(settings, "YANDEX_SPEECHKIT_API_KEY", "") or "").strip())


def synthesize_speech(text: str, *, voice: str = "alena") -> bytes | None:
    """Return Ogg Opus audio bytes or None."""
    api_key = (getattr(settings, "YANDEX_SPEECHKIT_API_KEY", "") or "").strip()
    if not api_key:
        return None
    say = (text or "").strip()[:MAX_TTS_CHARS]
    if not say:
        return None
    data = urllib.parse.urlencode(
        {
            "text": say,
            "lang": "ru-RU",
            "voice": voice or "alena",
            "format": "oggopus",
            "speed": "1.0",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TTS_URL,
        data=data,
        headers={"Authorization": f"Api-Key {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        logger.error("SpeechKit TTS HTTP %s: %s", e.code, body[:300])
    except Exception:
        logger.exception("SpeechKit TTS failed")
    return None


def attach_tts_to_response(result: dict, *, enabled: bool) -> dict:
    """Add say_audio_base64 when TTS is enabled and configured."""
    if not enabled or not speechkit_ready():
        return result
    say = (result.get("say") or "").strip()
    if not say:
        return result
    audio = synthesize_speech(say)
    if not audio:
        return result
    out = dict(result)
    out["say_audio_base64"] = base64.b64encode(audio).decode("ascii")
    out["say_audio_format"] = "oggopus"
    out["say_audio_content_type"] = "audio/ogg"
    return out


def _pick_b64(*values: object) -> str:
    for v in values:
        s = str(v or "").strip()
        if s:
            return s
    return ""


def extract_audio_from_payload(data: dict, ev: dict | None = None) -> tuple[bytes | None, str]:
    """Return raw audio bytes and format hint from webhook payload."""
    p = data or {}
    ev = ev or {}
    inner = p.get("json") if isinstance(p.get("json"), dict) else {}
    b64 = _pick_b64(
        ev.get("audio_base64"),
        p.get("audio_base64"),
        p.get("speech_audio_base64"),
        p.get("audio"),
        inner.get("speech_base64"),
        inner.get("audio_base64"),
    )
    fmt = _pick_b64(ev.get("audio_format"), p.get("audio_format"), inner.get("audio_format")) or "oggopus"
    if not b64:
        return None, fmt
    try:
        return base64.b64decode(b64), fmt
    except Exception:
        logger.exception("Voice webhook audio base64 decode failed")
        return None, fmt


def recognize_speech(audio: bytes, *, audio_format: str = "oggopus", lang: str = "ru-RU") -> str | None:
    """Return recognized text or None."""
    api_key = (getattr(settings, "YANDEX_SPEECHKIT_API_KEY", "") or "").strip()
    if not api_key or not audio:
        return None
    fmt = (audio_format or "oggopus").lower()
    if fmt in ("ogg", "opus"):
        fmt = "oggopus"
    query = urllib.parse.urlencode({"lang": lang, "format": fmt})
    url = f"{STT_URL}?{query}"
    req = urllib.request.Request(
        url,
        data=audio,
        headers={"Authorization": f"Api-Key {api_key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace").strip()
        if not body:
            return None
        try:
            parsed = json.loads(body)
            if isinstance(parsed, dict):
                return (parsed.get("result") or parsed.get("text") or "").strip() or None
        except json.JSONDecodeError:
            pass
        return body or None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        logger.error("SpeechKit STT HTTP %s: %s", e.code, err_body[:300])
    except Exception:
        logger.exception("SpeechKit STT failed")
    return None


def transcribe_event_text(data: dict, ev: dict) -> str:
    """Use ASR when telephony payload has audio but no text."""
    text = (ev.get("text") or "").strip()
    if text or not speechkit_ready():
        return text
    audio, fmt = extract_audio_from_payload(data, ev)
    if not audio:
        return ""
    recognized = recognize_speech(audio, audio_format=fmt)
    return (recognized or "").strip()
