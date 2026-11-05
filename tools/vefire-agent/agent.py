"""
Vefire cast agent: polls Vmeste API and opens URLs fullscreen for HDMI TV.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

API_URL = os.environ.get("VEFIRE_API_URL", "https://vsevmeste.space/api").rstrip("/")
USERNAME = os.environ.get("VEFIRE_USERNAME", "").strip()
PASSWORD = os.environ.get("VEFIRE_PASSWORD", "").strip()
REFRESH = os.environ.get("VEFIRE_REFRESH_TOKEN", "").strip()
POLL_SEC = max(1.0, float(os.environ.get("VEFIRE_POLL_SEC", "2")))
BROWSER = os.environ.get("VEFIRE_BROWSER", "edge").strip().lower()

session = requests.Session()
access_token = ""
refresh_token = REFRESH


def log(msg: str) -> None:
    print(msg, flush=True)


def set_auth(token: str) -> None:
    global access_token
    access_token = token
    session.headers["Authorization"] = f"Bearer {token}"


def login() -> None:
    global refresh_token
    if refresh_token:
        r = session.post(f"{API_URL}/auth/token/refresh/", json={"refresh": refresh_token}, timeout=30)
        if r.ok:
            set_auth(r.json()["access"])
            log("Auth: refreshed access token")
            return
        log(f"Refresh failed ({r.status_code}), trying username/password…")
    if not USERNAME or not PASSWORD:
        raise SystemExit("Set VEFIRE_USERNAME + VEFIRE_PASSWORD or VEFIRE_REFRESH_TOKEN in .env")
    r = session.post(
        f"{API_URL}/auth/token/",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=30,
    )
    if not r.ok:
        raise SystemExit(f"Login failed: {r.status_code} {r.text[:300]}")
    data = r.json()
    set_auth(data["access"])
    refresh_token = data.get("refresh") or refresh_token
    log(f"Auth: logged in as {USERNAME}")


def api_get(path: str):
    r = session.get(f"{API_URL}{path}", timeout=30)
    if r.status_code == 401:
        login()
        r = session.get(f"{API_URL}{path}", timeout=30)
    return r


def api_post(path: str, body: dict | None = None):
    r = session.post(f"{API_URL}{path}", json=body or {}, timeout=30)
    if r.status_code == 401:
        login()
        r = session.post(f"{API_URL}{path}", json=body or {}, timeout=30)
    return r


def find_browser() -> tuple[str, list[str]]:
    """Return (exe, base_args) for kiosk launch."""
    candidates: list[tuple[str, list[str], list[str]]] = []
    if BROWSER in ("edge", "default"):
        candidates.append(
            (
                "edge",
                [
                    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                ],
                ["--kiosk", "--edge-kiosk-type=fullscreen", "--no-first-run"],
            )
        )
    if BROWSER in ("chrome", "default"):
        candidates.append(
            (
                "chrome",
                [
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                ],
                ["--kiosk", "--no-first-run", "--disable-session-crashed-bubble"],
            )
        )

    for _name, paths, args in candidates:
        for p in paths:
            if Path(p).is_file():
                return p, args
        which = shutil.which("msedge" if _name == "edge" else "chrome")
        if which:
            return which, args

    # Fallback: os.startfile / default browser (may not be kiosk)
    return "", []


_browser_proc: subprocess.Popen | None = None


def open_fullscreen(url: str) -> None:
    global _browser_proc
    exe, args = find_browser()
    if _browser_proc and _browser_proc.poll() is None:
        try:
            _browser_proc.terminate()
        except Exception:
            pass
        time.sleep(0.4)

    if exe:
        cmd = [exe, *args, url]
        log(f"Launch: {' '.join(cmd[:3])} …")
        _browser_proc = subprocess.Popen(cmd)  # noqa: S603
        return

    log("No Edge/Chrome found — opening with default handler")
    if sys.platform.startswith("win"):
        os.startfile(url)  # type: ignore[attr-defined]
    else:
        subprocess.Popen(["xdg-open", url])


def claim_and_play() -> bool:
    r = api_get("/vefire/cast/next/")
    if not r.ok:
        log(f"Poll error: {r.status_code} {r.text[:200]}")
        return False
    job = (r.json() or {}).get("job")
    if not job:
        return False
    job_id = job["id"]
    url = job["url"]
    title = job.get("title") or ""
    log(f"Cast #{job_id}: {title or url}")
    try:
        open_fullscreen(url)
        api_post(f"/vefire/cast/{job_id}/ack/", {"ok": True})
        log(f"Ack ok #{job_id}")
    except Exception as e:  # noqa: BLE001
        api_post(f"/vefire/cast/{job_id}/ack/", {"ok": False, "error": str(e)})
        log(f"Ack fail #{job_id}: {e}")
    return True


def main() -> int:
    log(f"Vefire agent → {API_URL}")
    login()
    log(f"Polling every {POLL_SEC}s. Ctrl+C to stop.")
    while True:
        try:
            claim_and_play()
        except KeyboardInterrupt:
            log("Stopped.")
            return 0
        except Exception as e:  # noqa: BLE001
            log(f"Loop error: {e}")
        time.sleep(POLL_SEC)


if __name__ == "__main__":
    raise SystemExit(main())
