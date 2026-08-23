#!/usr/bin/env python3
"""Asterisk AGI: bridge phone call ↔ Vmeste voice webhook (STT/TTS via platform)."""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def read_agi_env() -> dict[str, str]:
    env: dict[str, str] = {}
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        line = line.strip()
        if not line:
            break
        key, val = line.split(":", 1)
        env[key.strip()] = val.strip()
    return env


def agi_command(cmd: str) -> str:
    sys.stdout.write(f"{cmd}\n")
    sys.stdout.flush()
    return sys.stdin.readline().strip()


def parse_agi_result(raw: str) -> tuple[int, str]:
    if raw.startswith("200"):
        part = raw.split("=", 1)
        return 200, part[1].strip() if len(part) > 1 else ""
    if raw.startswith("520"):
        return 520, raw
    try:
        code = int(raw.split()[0])
    except ValueError:
        code = 500
    return code, raw


def http_json(url: str, *, method: str = "GET", headers: dict | None = None, body: dict | None = None) -> dict:
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace") or "{}")


def resolve_token(api_base: str, secret: str, did: str) -> str:
    q = urllib.parse.quote(did or "")
    url = f"{api_base.rstrip('/')}/voice/asterisk/resolve/?did={q}"
    data = http_json(url, headers={"X-Asterisk-Secret": secret})
    return (data.get("webhook_token") or "").strip()


def voice_turn(api_base: str, token: str, payload: dict) -> dict:
    url = f"{api_base.rstrip('/')}/voice/webhook/inbound/"
    return http_json(
        url,
        method="POST",
        headers={"X-Voice-Token": token, "Content-Type": "application/json"},
        body={"ats": "asterisk", **payload},
    )


def play_response(unique_id: str, result: dict) -> None:
    audio_b64 = (result.get("say_audio_base64") or "").strip()
    say = (result.get("say") or "").strip()
    if audio_b64:
        path = f"/tmp/vmeste-{unique_id}.ogg"
        with open(path, "wb") as f:
            f.write(base64.b64decode(audio_b64))
        agi_command(f"STREAM FILE {path} \"\"")
        return
    if say:
        # Fallback — limited phonetic spelling; TTS on platform is preferred.
        safe = say.replace("\"", "").replace("\n", " ")[:400]
        agi_command(f"SAY ALPHA \"{safe}\"")


def record_wav(unique_id: str, turn: int) -> str | None:
    path = f"/tmp/vmeste-rec-{unique_id}-{turn}"
    # RECORD FILE: filename format maxduration BEEP
    res = parse_agi_result(agi_command(f"RECORD FILE {path} wav \"#\" 12 0000 beep"))
    if res[0] != 200:
        return None
    wav_path = f"{path}.wav"
    return wav_path if os.path.isfile(wav_path) else None


def wav_to_b64(path: str) -> str | None:
    try:
        with open(path, "rb") as f:
            return base64.b64encode(f.read()).decode("ascii")
    except OSError:
        return None


def main() -> int:
    read_agi_env()
    did = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
    caller = (sys.argv[2] if len(sys.argv) > 2 else "").strip()
    api_base = (os.environ.get("VOICE_PUBLIC_BASE_URL") or "http://web:8000/api").strip()
    secret = (os.environ.get("ASTERISK_INTERNAL_SECRET") or "").strip()
    unique_id = parse_agi_result(agi_command("GET VARIABLE UNIQUEID"))[1] or "call"

    agi_command("ANSWER")
    agi_command("WAIT 1")

    if not secret:
        agi_command('SAY ALPHA "voice not configured"')
        agi_command("HANGUP")
        return 1

    try:
        token = resolve_token(api_base, secret, did)
    except Exception:
        token = ""

    if not token:
        agi_command('SAY ALPHA "salon not found"')
        agi_command("HANGUP")
        return 1

    call_id = unique_id
    payload_base = {
        "call_id": call_id,
        "caller_phone": caller,
        "called_phone": did,
    }

    try:
        result = voice_turn(api_base, token, {**payload_base, "event": "incoming"})
    except Exception:
        agi_command('SAY ALPHA "service unavailable"')
        agi_command("HANGUP")
        return 1

    play_response(unique_id, result)
    if (result.get("action") or "") == "hangup":
        agi_command("HANGUP")
        return 0

    for turn in range(8):
        wav = record_wav(unique_id, turn)
        if not wav:
            break
        audio_b64 = wav_to_b64(wav)
        try:
            result = voice_turn(
                api_base,
                token,
                {
                    **payload_base,
                    "event": "speech",
                    "audio_base64": audio_b64 or "",
                    "audio_format": "wav",
                },
            )
        except Exception:
            agi_command('SAY ALPHA "error"')
            break
        play_response(unique_id, result)
        if (result.get("action") or "") in ("hangup", "transfer"):
            transfer = (result.get("transfer_phone") or "").strip()
            if result.get("action") == "transfer" and transfer:
                agi_command(f"DIAL PJSIP/{transfer},30")
            break

    agi_command("HANGUP")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
