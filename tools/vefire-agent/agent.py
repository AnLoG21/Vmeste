"""
Vefire cast agent: HDMI TV browser + phone remote mirror.
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

# Windows cp1251 consoles crash on arrows/emoji in print().
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

import requests
from dotenv import load_dotenv

from cdp_browser import CdpBrowser

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")

# Dead local VPN proxies (e.g. 127.0.0.1:12334) break API + pip + page loads.
for _k in (
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "http_proxy",
    "https_proxy",
    "ALL_PROXY",
    "all_proxy",
):
    os.environ.pop(_k, None)
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

API_URL = os.environ.get("VEFIRE_API_URL", "https://vsevmeste.space/api").rstrip("/")
USERNAME = os.environ.get("VEFIRE_USERNAME", "").strip()
PASSWORD = os.environ.get("VEFIRE_PASSWORD", "").strip()
REFRESH = os.environ.get("VEFIRE_REFRESH_TOKEN", "").strip()
POLL_SEC = max(1.0, float(os.environ.get("VEFIRE_POLL_SEC", "2")))
BROWSER = os.environ.get("VEFIRE_BROWSER", "edge").strip().lower()
REMOTE_PORT = int(os.environ.get("VEFIRE_REMOTE_PORT", "8765"))
DEBUG_PORT = int(os.environ.get("VEFIRE_DEBUG_PORT", "9222"))
# Never auto-open a content site — only navigate on explicit cast / user home.
# Local idle page so CDP screencast emits frames (about:blank often does not).
BLANK_URL = (ROOT / "idle.html").resolve().as_uri()
HOME_URL = os.environ.get("VEFIRE_HOME_URL", BLANK_URL).strip() or BLANK_URL
PROFILE_DIR = ROOT / ".browser-profile"

session = requests.Session()
session.trust_env = False  # ignore Windows/system proxy for API calls
refresh_token = REFRESH
_browser_proc: subprocess.Popen | None = None
_cdp: CdpBrowser | None = None
_cdp_lock = threading.Lock()
_current_url = BLANK_URL
_latest_jpeg = b""
_latest_meta = {"width": 1280, "height": 720, "ready": False}
_jpeg_cond = threading.Condition()
_upload_lock = threading.Lock()
_last_upload_ts = 0.0
_frame_fail_logged = False
_frame_ok_count = 0
_launching = False
_last_frame_ts = 0.0


def log(msg: str) -> None:
    text = str(msg)
    try:
        print(text, flush=True)
    except UnicodeEncodeError:
        enc = getattr(sys.stdout, "encoding", None) or "utf-8"
        safe = text.encode(enc, errors="replace").decode(enc, errors="replace")
        print(safe, flush=True)


def is_kinopoisk_home(url: str) -> bool:
    u = (url or "").strip().rstrip("/").lower()
    return u in (
        "https://www.kinopoisk.ru",
        "http://www.kinopoisk.ru",
        "https://kinopoisk.ru",
        "http://kinopoisk.ru",
    )


def wipe_session_restore(profile: Path) -> None:
    """Stop Edge/Chrome from reopening old tabs (Kinopoisk etc.) on launch."""
    victims = [
        profile / "Default" / "Current Session",
        profile / "Default" / "Last Session",
        profile / "Default" / "Current Tabs",
        profile / "Default" / "Last Tabs",
        profile / "Default" / "Sessions",
        profile / "Default" / "Session Storage",
        profile / "SingletonLock",
        profile / "SingletonSocket",
        profile / "SingletonCookie",
        profile / "lockfile",
    ]
    for p in victims:
        try:
            if p.is_file() or p.is_symlink():
                p.unlink(missing_ok=True)
            elif p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
        except Exception:
            pass


def debug_port_up(timeout: float = 1.0) -> bool:
    try:
        r = requests.get(
            f"http://127.0.0.1:{DEBUG_PORT}/json/version",
            timeout=timeout,
            proxies={"http": None, "https": None},
        )
        return r.ok
    except Exception:
        return False


def wait_debug_port(timeout: float = 20.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if debug_port_up(1.2):
            return True
        time.sleep(0.35)
    return False


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
        log(f"Refresh failed ({r.status_code}), trying username/password...")
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
    common_args = [
        "--kiosk",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-session-crashed-bubble",
        "--hide-crash-restore-bubble",
        "--disable-restore-session-state",
        "--noerrdialogs",
        # Bypass broken system proxy (127.0.0.1:12334) so TV pages actually load.
        "--no-proxy-server",
        f"--remote-debugging-port={DEBUG_PORT}",
        "--remote-allow-origins=*",
        f"--user-data-dir={PROFILE_DIR}",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-features=TranslateUI,InfiniteSessionRestore,TriggeringRefreshRateThrottling",
        "--check-for-update-interval=31536000",
    ]
    if BROWSER in ("edge", "default"):
        candidates.append(
            (
                "edge",
                [
                    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                ],
                [*common_args, "--edge-kiosk-type=fullscreen"],
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
                common_args,
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


def on_frame(jpeg: bytes, width: int, height: int) -> None:
    global _latest_jpeg, _last_upload_ts, _frame_fail_logged, _frame_ok_count, _last_frame_ts
    _last_frame_ts = time.time()
    with _jpeg_cond:
        _latest_jpeg = jpeg
        _latest_meta["width"] = width
        _latest_meta["height"] = height
        _latest_meta["ready"] = True
        _jpeg_cond.notify_all()
    now = time.time()
    if now - _last_upload_ts < 0.15:
        return
    if not _upload_lock.acquire(blocking=False):
        return
    try:
        if now - _last_upload_ts < 0.15:
            return
        _last_upload_ts = now
        payload = jpeg
        # API rejects >450KB; screenshot quality is tuned small.
        if len(payload) > 420_000:
            if not _frame_fail_logged:
                log(f"Frame skipped (too large: {len(payload)} B)")
                _frame_fail_logged = True
            return
        files = {"frame": ("frame.jpg", payload, "image/jpeg")}
        data = {"width": str(width), "height": str(height)}
        headers = {}
        auth = session.headers.get("Authorization")
        if auth:
            headers["Authorization"] = auth
        r = session.post(
            f"{API_URL}/vefire/agent/frame/",
            files=files,
            data=data,
            headers=headers,
            timeout=12,
        )
        if r.status_code == 401:
            login()
            auth = session.headers.get("Authorization")
            if auth:
                headers["Authorization"] = auth
            r = session.post(
                f"{API_URL}/vefire/agent/frame/",
                files=files,
                data=data,
                headers=headers,
                timeout=12,
            )
        if not r.ok:
            if not _frame_fail_logged:
                log(f"Frame upload failed: {r.status_code} {r.text[:200]}")
                _frame_fail_logged = True
        else:
            _frame_ok_count += 1
            if _frame_fail_logged or _frame_ok_count % 50 == 1:
                log(f"Frame upload ok ({len(payload)} B, {width}x{height})")
            _frame_fail_logged = False
    except Exception as e:  # noqa: BLE001
        if not _frame_fail_logged:
            log(f"Frame upload error: {e}")
            _frame_fail_logged = True
    finally:
        _upload_lock.release()


def _cdp_alive(cdp: CdpBrowser) -> bool:
    try:
        cdp.call("Runtime.evaluate", {"expression": "1"}, timeout=2.0)
        return True
    except Exception:
        return False


def _attach_cdp(
    prefer_url: str | None = None,
    solo_tab: bool = False,
    navigate: bool = False,
) -> CdpBrowser:
    global _cdp
    cdp = CdpBrowser(DEBUG_PORT)
    cdp.on_frame = on_frame
    # Reuse existing tab — opening json/new about:blank was causing random blank windows.
    cdp.connect(prefer_url=prefer_url, solo_tab=solo_tab, navigate=navigate)
    cdp.start_screencast()
    _cdp = cdp
    _latest_meta["ready"] = True
    return cdp


def ensure_browser(start_url: str | None = None, force_relaunch: bool = False) -> CdpBrowser:
    """Keep current page unless start_url is explicitly provided (cast)."""
    global _browser_proc, _cdp, _current_url, _launching, _last_frame_ts
    with _cdp_lock:
        if start_url:
            _current_url = start_url

        browser_running = (not force_relaunch) and (
            (_browser_proc is not None and _browser_proc.poll() is None) or debug_port_up()
        )

        if browser_running:
            if _cdp and _cdp_alive(_cdp):
                if start_url:
                    log(f"Navigate: {start_url}")
                    _cdp.navigate(start_url)
                    try:
                        _cdp.close_stray_blank_tabs()
                        _cdp.start_screencast()
                    except Exception:
                        pass
                else:
                    try:
                        _cdp.close_stray_blank_tabs()
                    except Exception:
                        pass
                return _cdp
            # Browser still up — only reattach CDP, do NOT open a new blank tab
            log("CDP reconnect (keeping current tab)")
            try:
                if _cdp:
                    try:
                        _cdp.close()
                    except Exception:
                        pass
                cdp = _attach_cdp(
                    prefer_url=start_url or _current_url,
                    solo_tab=False,
                    navigate=bool(start_url),
                )
                return cdp
            except Exception as e:  # noqa: BLE001
                log(f"CDP reattach failed: {e} - will relaunch browser")

        exe, args = find_browser()
        if not exe:
            raise RuntimeError("Edge/Chrome not found")
        PROFILE_DIR.mkdir(parents=True, exist_ok=True)
        wipe_session_restore(PROFILE_DIR)
        # Only open idle page or the explicit cast URL — never surprise Kinopoisk
        launch_url = start_url or _current_url or BLANK_URL
        if not start_url and (is_kinopoisk_home(launch_url) or is_kinopoisk_home(HOME_URL)):
            launch_url = BLANK_URL
        if is_kinopoisk_home(HOME_URL) and not start_url:
            launch_url = BLANK_URL
        cmd = [exe, *args, launch_url]
        log(f"Launch browser -> {launch_url}")
        _launching = True
        if _browser_proc and _browser_proc.poll() is None:
            try:
                _browser_proc.terminate()
            except Exception:
                pass
            time.sleep(0.8)
        _browser_proc = subprocess.Popen(cmd)  # noqa: S603
        if not wait_debug_port(20.0):
            # Edge sometimes ignores debug port while another profile holds locks — retry once.
            log("Debug port not ready - wiping profile locks and retrying browser")
            try:
                _browser_proc.terminate()
            except Exception:
                pass
            time.sleep(1.0)
            wipe_session_restore(PROFILE_DIR)
            _browser_proc = subprocess.Popen(cmd)  # noqa: S603
            if not wait_debug_port(20.0):
                _launching = False
                raise RuntimeError(f"Browser debug port {DEBUG_PORT} did not open")
        try:
            # Browser already opened launch_url — attach to that tab, don't create another.
            cdp = _attach_cdp(prefer_url=launch_url, solo_tab=True, navigate=False)
            try:
                cdp.close_stray_blank_tabs()
            except Exception:
                pass
            if _last_frame_ts <= 0:
                _last_frame_ts = time.time()
            return cdp
        finally:
            _launching = False


def open_fullscreen(url: str) -> None:
    ensure_browser(url)


def browser_watchdog_loop() -> None:
    """Keep CDP frame capture alive — without frames the phone remote stays black."""
    global _cdp
    while True:
        time.sleep(5.0)
        if _launching:
            continue
        try:
            port_ok = debug_port_up()
            cdp_ok = bool(_cdp and _cdp_alive(_cdp))
            if _last_frame_ts <= 0:
                frame_age = 0.0
            else:
                frame_age = time.time() - _last_frame_ts
            if port_ok and cdp_ok:
                try:
                    with _cdp_lock:
                        if _cdp:
                            n = _cdp.close_stray_blank_tabs()
                            if n:
                                log(f"Closed {n} stray about:blank tab(s)")
                except Exception:
                    pass
            if port_ok and cdp_ok and frame_age < 15:
                continue
            if port_ok and cdp_ok and frame_age >= 15:
                log(f"No frames for {int(frame_age)}s - restart capture")
                try:
                    with _cdp_lock:
                        if _cdp:
                            try:
                                _cdp.stop_screencast()
                            except Exception:
                                pass
                            _cdp.start_screencast()
                    continue
                except Exception as e:  # noqa: BLE001
                    log(f"Capture restart failed: {e}")
            log(
                f"Browser watchdog: port={port_ok} cdp={cdp_ok} frame_age={int(frame_age)}s - relaunch"
            )
            # Relaunch only if the browser/CDP is actually dead — keep current content URL.
            ensure_browser(
                _current_url if _current_url else BLANK_URL,
                force_relaunch=True,
            )
        except Exception as e:  # noqa: BLE001
            log(f"Watchdog: {e}")


def _job_age_sec(job: dict) -> float | None:
    raw = job.get("created_at") or ""
    if not raw:
        return None
    try:
        from datetime import datetime, timezone

        # Django ISO: 2026-11-05T18:50:32.472490Z
        ts = str(raw).replace("Z", "+00:00")
        created = datetime.fromisoformat(ts)
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - created).total_seconds()
    except Exception:
        return None


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
    age = _job_age_sec(job)
    # Safety if prod has not expired old pending jobs yet.
    if age is not None and age > 90:
        log(f"Skip stale cast #{job_id} ({int(age)}s old): {title or url}")
        api_post(f"/vefire/cast/{job_id}/ack/", {"ok": False, "error": "stale_client"})
        return True
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
            remote_url = f"http://{(ips[0] if ips else '127.0.0.1')}:{REMOTE_PORT}/"
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
        time.sleep(0.05)


def handle_input(data: dict) -> dict:
    # Never pass a default content URL here — reconnect must keep the tab
    cdp = ensure_browser(None)
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
            # Explicit user action only — blank, not Kinopoisk from old .env
            target = BLANK_URL if is_kinopoisk_home(HOME_URL) else (HOME_URL or BLANK_URL)
            global _current_url
            _current_url = target
            cdp.navigate(target)
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
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self._cors()
            self.end_headers()
            try:
                while True:
                    with _jpeg_cond:
                        _jpeg_cond.wait(timeout=2.0)
                        jpeg = _latest_jpeg
                    if not jpeg:
                        time.sleep(0.2)
                        continue
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ")
                    self.wfile.write(str(len(jpeg)).encode("ascii"))
                    self.wfile.write(b"\r\n\r\n")
                    self.wfile.write(jpeg)
                    self.wfile.write(b"\r\n")
                    self.wfile.flush()
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


def drain_stale_input() -> None:
    """Drop backlog accumulated while agent was offline."""
    try:
        r = api_get("/vefire/agent/input/")
        n = len((r.json() or {}).get("events") or []) if r.ok else 0
        if n:
            log(f"Dropped {n} stale remote events")
    except Exception as e:  # noqa: BLE001
        log(f"Input drain: {e}")


def main() -> int:
    log(f"Vefire agent -> {API_URL}")
    if is_kinopoisk_home(HOME_URL):
        log("VEFIRE_HOME_URL points to Kinopoisk - ignoring, start about:blank")
    login()
    drain_stale_input()
    try:
        # Blank start — wait for cast from phone (no auto Kinopoisk)
        ensure_browser(BLANK_URL)
    except Exception as e:  # noqa: BLE001
        log(f"Browser start warning: {e}")

    server = ThreadingHTTPServer(("0.0.0.0", REMOTE_PORT), RemoteHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log("Started. Cast from Vmeste -> Vefire; open Remote on phone.")
    log("Lid closed: Win+P = Second screen only; Power = Do nothing when lid closes.")

    threading.Thread(target=poll_loop, daemon=True).start()
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    threading.Thread(target=input_poll_loop, daemon=True).start()
    threading.Thread(target=browser_watchdog_loop, daemon=True).start()

    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        log("Stopped.")
        if _cdp:
            _cdp.close()
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        log(f"FATAL: {exc}")
        import traceback

        traceback.print_exc()
        raise SystemExit(1) from exc
