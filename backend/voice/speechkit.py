"""Yandex SpeechKit TTS/STT for voice webhook responses."""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from .usage import can_use_speechkit, consume_voice_seconds

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
        try:
            from common.ops_alerts import alert_ops

            alert_ops("speechkit_tts_http", f"HTTP {e.code}: {body[:200]}")
        except Exception:
            pass
    except Exception:
        logger.exception("SpeechKit TTS failed")
        try:
            from common.ops_alerts import alert_ops

            alert_ops("speechkit_tts_failed", "exception")
        except Exception:
            pass
    return None


def attach_tts_to_response(result: dict, *, enabled: bool, vs=None) -> dict:
    """Add say_audio_base64 when TTS is enabled and configured."""
    if not enabled or not speechkit_ready():
        return result
    if vs is not None and not can_use_speechkit(vs):
        out = dict(result)
        out["quota_exceeded"] = True
        return out
    say = (result.get("say") or "").strip()
    if not say:
        return result
    audio = synthesize_speech(say)
    if not audio:
        return result
    if vs is not None:
        consume_voice_seconds(vs, max(2.0, len(say) / 12.0))
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


def _prepare_stt_audio(audio: bytes, fmt: str) -> tuple[bytes, str, int | None]:
    """Return payload bytes, stt format, optional sample rate."""
    fmt = (fmt or "oggopus").lower()
    if fmt in ("wav", "wave"):
        import io
        import wave

        with wave.open(io.BytesIO(audio), "rb") as wf:
            frames = wf.readframes(wf.getnframes())
            return frames, "lpcm", wf.getframerate()
    return audio, fmt, None


def recognize_speech(audio: bytes, *, audio_format: str = "oggopus", lang: str = "ru-RU") -> str | None:
    """Return recognized text or None."""
    api_key = (getattr(settings, "YANDEX_SPEECHKIT_API_KEY", "") or "").strip()
    if not api_key or not audio:
        return None
    payload, fmt, sample_rate = _prepare_stt_audio(audio, audio_format)
    if fmt in ("ogg", "opus"):
        fmt = "oggopus"
    params = {"lang": lang, "format": fmt}
    if fmt == "lpcm":
        params["sampleRateHertz"] = str(sample_rate or 8000)
    query = urllib.parse.urlencode(params)
    url = f"{STT_URL}?{query}"
    req = urllib.request.Request(
        url,
        data=payload,
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
        try:
            from common.ops_alerts import alert_ops

            alert_ops("speechkit_stt_http", f"HTTP {e.code}: {err_body[:200]}")
        except Exception:
            pass
    except Exception:
        logger.exception("SpeechKit STT failed")
        try:
            from common.ops_alerts import alert_ops

            alert_ops("speechkit_stt_failed", "exception")
        except Exception:
            pass
    return None


def transcribe_event_text(data: dict, ev: dict, vs=None) -> str:
    """Use ASR when telephony payload has audio but no text."""
    text = (ev.get("text") or "").strip()
    if text or not speechkit_ready():
        return text
    if vs is not None and not can_use_speechkit(vs):
        return ""
    audio, fmt = extract_audio_from_payload(data, ev)
    if not audio:
        return ""
    recognized = recognize_speech(audio, audio_format=fmt)
    if recognized and vs is not None:
        consume_voice_seconds(vs, 8.0)
    return (recognized or "").strip()
