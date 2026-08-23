"""Yandex SpeechKit TTS for voice webhook responses."""

from __future__ import annotations

import base64
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

TTS_URL = "https://tts.api.cloud.yandex.net/speech/v1/tts:synthesize"
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
