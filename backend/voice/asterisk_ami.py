"""Asterisk AMI originate for outbound confirmation calls."""

from __future__ import annotations

import logging
import socket
import uuid

from django.conf import settings

logger = logging.getLogger(__name__)


def _ami_secret() -> str:
    return (
        (getattr(settings, "ASTERISK_AMI_SECRET", "") or "").strip()
        or (getattr(settings, "ASTERISK_INTERNAL_SECRET", "") or "").strip()
    )


def asterisk_ami_ready() -> bool:
    return bool(_ami_secret())


def _read_until_empty(sock: socket.socket) -> str:
    chunks = []
    buf = b""
    while True:
        data = sock.recv(4096)
        if not data:
            break
        buf += data
        if b"\r\n\r\n" in buf:
            chunks.append(buf.decode("utf-8", errors="replace"))
            break
    return "".join(chunks)


def asterisk_originate(
    *,
    endpoint: str,
    to_number: str,
    did: str,
    command_id: str | None = None,
) -> dict:
    """
    Dial client via PJSIP trunk, then AGI (same as inbound).
    endpoint: vmeste-p{provider_id}
    """
    host = (getattr(settings, "ASTERISK_AMI_HOST", "") or "asterisk").strip()
    port = int(getattr(settings, "ASTERISK_AMI_PORT", 5038) or 5038)
    user = (getattr(settings, "ASTERISK_AMI_USER", "") or "vmeste").strip()
    secret = _ami_secret()
    to = "".join(ch for ch in str(to_number) if ch.isdigit())
    did_d = "".join(ch for ch in str(did) if ch.isdigit())
    ep = (endpoint or "").strip()
    if not secret or len(to) < 10 or not ep:
        return {"ok": False, "error": "Asterisk AMI не настроен или нет номера."}

    cid = command_id or str(uuid.uuid4())
    channel = f"PJSIP/{to}@{ep}"
    agi = f"agi://127.0.0.1/vmeste_agi.py,{did_d},{to}"
    # Application AGI on the answered channel
    actions = (
        f"Action: Login\r\nUsername: {user}\r\nSecret: {secret}\r\n\r\n"
        f"Action: Originate\r\n"
        f"Channel: {channel}\r\n"
        f"Application: AGI\r\n"
        f"Data: vmeste_agi.py,{did_d},{to}\r\n"
        f"CallerID: {did_d}\r\n"
        f"Async: true\r\n"
        f"ActionID: {cid}\r\n"
        f"\r\n"
        f"Action: Logoff\r\n\r\n"
    )
    try:
        with socket.create_connection((host, port), timeout=12) as sock:
            sock.settimeout(12)
            sock.recv(4096)
            sock.sendall(actions.encode("utf-8"))
            _read_until_empty(sock)
            rest = b""
            try:
                while True:
                    chunk = sock.recv(4096)
                    if not chunk:
                        break
                    rest += chunk
                    if len(rest) > 8000:
                        break
            except socket.timeout:
                pass
        text = rest.decode("utf-8", errors="replace")
        ok = "Success" in text or "Originate successfully queued" in text or not text
        if "Error" in text and "Success" not in text:
            ok = False
        return {"ok": ok, "command_id": cid, "raw": text[:400], "agi": agi}
    except OSError as e:
        logger.exception("Asterisk AMI connect failed")
        return {"ok": False, "error": str(e), "command_id": cid}
