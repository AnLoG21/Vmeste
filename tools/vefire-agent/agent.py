"""
Vefire cast agent: HDMI TV browser + phone remote mirror (MJPEG + input).
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import requests
from dotenv import load_dotenv

from cdp_browser import CdpBrowser

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

API_URL = os.environ.get("VEFIRE_API_URL", "https://vsevmeste.space/api").rstrip("/")
USERNAME = os.environ.get("VEFIRE_USERNAME", "").strip()
PASSWORD = os.environ.get("VEFIRE_PASSWORD", "").strip()
REFRESH = os.environ.get("VEFIRE_REFRESH_TOKEN", "").strip()
POLL_SEC = max(1.0, float(os.environ.get("VEFIRE_POLL_SEC", "2")))
BROWSER = os.environ.get("VEFIRE_BROWSER", "edge").strip().lower()
REMOTE_PORT = int(os.environ.get("VEFIRE_REMOTE_PORT", "8765"))
DEBUG_PORT = int(os.environ.get("VEFIRE_DEBUG_PORT", "9222"))
HOME_URL = os.environ.get("VEFIRE_HOME_URL", "https://www.kinopoisk.ru/").strip()
PROFILE_DIR = ROOT / ".browser-profile"

session = requests.Session()
refresh_token = REFRESH
_browser_proc: subprocess.Popen | None = None
_cdp: CdpBrowser | None = None
_cdp_lock = threading.Lock()
_latest_jpeg = b""
_latest_meta = {"width": 1280, "height": 720, "ready": False}
_jpeg_cond = threading.Condition()


def log(msg: str) -> None:
    print(msg, flush=True)


def set_auth(token: str) -> None:
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


def lan_ips() -> list[str]:
    ips: list[str] = []
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            ip = info[4][0]
            if not ip.startswith("127.") and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip not in ips:
            ips.insert(0, ip)
    except Exception:
        pass
    return ips


def find_browser() -> tuple[str, list[str]]:
    candidates: list[tuple[str, list[str], list[str]]] = []
    if BROWSER in ("edge", "default"):
        candidates.append(
            (
                "edge",
                [
                    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                ],
                [
                    "--kiosk",
                    "--edge-kiosk-type=fullscreen",
                    "--no-first-run",
                    f"--remote-debugging-port={DEBUG_PORT}",
                    f"--user-data-dir={PROFILE_DIR}",
                    "--disable-features=TranslateUI",
                    "--autoplay-policy=no-user-gesture-required",
                ],
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
                [
                    "--kiosk",
                    "--no-first-run",
                    "--disable-session-crashed-bubble",
                    f"--remote-debugging-port={DEBUG_PORT}",
                    f"--user-data-dir={PROFILE_DIR}",
                    "--autoplay-policy=no-user-gesture-required",
                ],
            )
        )
    for _name, paths, args in candidates:
        for p in paths:
            if Path(p).is_file():
                return p, args
        which = shutil.which("msedge" if _name == "edge" else "chrome")
        if which:
            return which, args
    return "", []


_last_upload_ts = 0.0


def on_frame(jpeg: bytes, width: int, height: int) -> None:
    global _latest_jpeg, _last_upload_ts
    with _jpeg_cond:
        _latest_jpeg = jpeg
        _latest_meta["width"] = width
        _latest_meta["height"] = height
        _latest_meta["ready"] = True
        _jpeg_cond.notify_all()
    # Throttle uploads to Vmeste (~4 fps) for in-app remote
    now = time.time()
    if now - _last_upload_ts < 0.25:
        return
    _last_upload_ts = now
    try:
        files = {"frame": ("frame.jpg", jpeg, "image/jpeg")}
        data = {"width": str(width), "height": str(height)}
        r = session.post(f"{API_URL}/vefire/agent/frame/", files=files, data=data, timeout=8)
        if r.status_code == 401:
            login()
            session.post(f"{API_URL}/vefire/agent/frame/", files=files, data=data, timeout=8)
    except Exception:
        pass


def input_poll_loop() -> None:
    while True:
        try:
            r = api_get("/vefire/agent/input/")
            if r.ok:
                events = (r.json() or {}).get("events") or []
                for ev in events:
                    try:
                        handle_input(ev if isinstance(ev, dict) else {})
                    except Exception as e:  # noqa: BLE001
                        log(f"Input apply: {e}")
        except Exception as e:  # noqa: BLE001
            log(f"Input poll: {e}")
        time.sleep(0.12)


def ensure_browser(start_url: str | None = None) -> CdpBrowser:
    global _browser_proc, _cdp
    with _cdp_lock:
        if _cdp and _browser_proc and _browser_proc.poll() is None:
            if start_url:
                _cdp.navigate(start_url)
            return _cdp

        exe, args = find_browser()
        if not exe:
            raise RuntimeError("Edge/Chrome not found")
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        url = start_url or HOME_URL
        cmd = [exe, *args, url]
        log(f"Launch browser debug:{DEBUG_PORT}")
        if _browser_proc and _browser_proc.poll() is None:
            try:
                _browser_proc.terminate()
            except Exception:
                pass
            time.sleep(0.5)
        _browser_proc = subprocess.Popen(cmd)  # noqa: S603
        time.sleep(1.2)
        cdp = CdpBrowser(DEBUG_PORT)
        cdp.on_frame = on_frame
        cdp.connect()
        cdp.start_screencast()
        _cdp = cdp
        _latest_meta["ready"] = True
        return cdp


def open_fullscreen(url: str) -> None:
    ensure_browser(url)


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


def heartbeat_loop() -> None:
    while True:
        try:
            ips = lan_ips()
            if ips:
                remote_url = f"http://{ips[0]}:{REMOTE_PORT}/"
                api_post("/vefire/agent/heartbeat/", {"remote_url": remote_url, "ips": ips})
        except Exception as e:  # noqa: BLE001
            log(f"Heartbeat: {e}")
        time.sleep(15)


def poll_loop() -> None:
    while True:
        try:
            claim_and_play()
        except Exception as e:  # noqa: BLE001
            log(f"Poll loop: {e}")
        time.sleep(POLL_SEC)


def handle_input(data: dict) -> dict:
    cdp = ensure_browser()
    typ = data.get("type")
    if typ == "pointer":
        cdp.mouse(
            str(data.get("phase") or "up"),
            float(data.get("x") or 0),
            float(data.get("y") or 0),
            click=bool(data.get("click")),
            double=bool(data.get("double")),
        )
    elif typ == "scroll":
        cdp.scroll(
            float(data.get("x") or 0),
            float(data.get("y") or 0),
            float(data.get("dx") or 0),
            float(data.get("dy") or 0),
        )
    elif typ == "text":
        cdp.insert_text(str(data.get("text") or ""))
    elif typ == "key":
        cdp.key(str(data.get("key") or "Enter"))
    elif typ == "nav":
        action = data.get("action")
        if action == "back":
            cdp.history_back()
        elif action == "reload":
            cdp.reload()
        elif action == "home":
            cdp.navigate(HOME_URL)
    return {"ok": True, "width": _latest_meta["width"], "height": _latest_meta["height"]}


class RemoteHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return

    def _cors(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/remote", "/remote/"):
            body = (ROOT / "remote.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/api/meta":
            body = json.dumps(_latest_meta).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
            return
        if path.startswith("/stream.mjpg"):
            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self._cors()
            self.end_headers()
            try:
                while True:
                    with _jpeg_cond:
                        ok = _jpeg_cond.wait(timeout=2.0)
                        jpeg = _latest_jpeg
                    if not jpeg:
                        # tiny black jpeg placeholder skipped — wait for real frame
                        time.sleep(0.2)
                        continue
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ")
                    self.wfile.write(str(len(jpeg)).encode("ascii"))
                    self.wfile.write(b"\r\n\r\n")
                    self.wfile.write(jpeg)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
                    if not ok:
                        time.sleep(0.05)
            except (BrokenPipeError, ConnectionResetError):
                return
            return
        self.send_error(404)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path != "/api/input":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8") or "{}")
            result = handle_input(data)
        except Exception as e:  # noqa: BLE001
            result = {"ok": False, "error": str(e)}
        body = json.dumps(result).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    log(f"Vefire agent → {API_URL}")
    login()
    try:
        ensure_browser(HOME_URL)
    except Exception as e:  # noqa: BLE001
        log(f"Browser start warning: {e}")

    server = ThreadingHTTPServer(("0.0.0.0", REMOTE_PORT), RemoteHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    ips = lan_ips() or ["127.0.0.1"]
    log("——— Пульт с телефона ———")
    for ip in ips:
        log(f"  http://{ip}:{REMOTE_PORT}/")
    log("Телефон и ноут в одной Wi‑Fi. Windows Firewall: разреши Python/порт 8765.")
    log("Крышка ноута: Питание → при закрытии → «Ничего не делать», Win+P → только ТВ.")

    threading.Thread(target=poll_loop, daemon=True).start()
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    threading.Thread(target=input_poll_loop, daemon=True).start()
    log("Пульт внутри Вместе → Вэфире → «Пульт» (зеркало без отдельной ссылки).")

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        log("Stopped.")
        if _cdp:
            _cdp.close()
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
