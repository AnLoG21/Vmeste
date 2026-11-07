"""Minimal Chrome/Edge DevTools Protocol client for navigate + frames + input."""
from __future__ import annotations

import base64
import json
import threading
import time
from typing import Any, Callable
from urllib.parse import urlparse

import requests

# Ignore broken system HTTP proxy for local DevTools + any CDP HTTP helpers.
_NO_PROXY = {"http": None, "https": None}

try:
    # Correct package is websocket-client (imports as websocket).
    from websocket import create_connection
    from websocket._exceptions import WebSocketConnectionClosedException
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Нужен пакет websocket-client.\n"
        "Выполни: python -m pip uninstall -y websocket\n"
        "          python -m pip install -U websocket-client\n"
        f"({exc})"
    ) from exc


def _url_key(url: str) -> str:
    try:
        p = urlparse(url or "")
        return f"{p.scheme}://{p.netloc}{p.path}".rstrip("/").lower()
    except Exception:
        return (url or "").rstrip("/").lower()


class CdpBrowser:
    def __init__(self, debug_port: int = 9222):
        self.debug_port = debug_port
        self.ws = None
        self._id = 0
        self._lock = threading.Lock()
        self._pending: dict[int, dict] = {}
        self._reader: threading.Thread | None = None
        self._alive = False
        self.frame_width = 1280
        self.frame_height = 720
        self.on_frame: Callable[[bytes, int, int], None] | None = None
        self.target_id: str | None = None
        self._shot_thread: threading.Thread | None = None
        self._shot_alive = False

    def _base(self) -> str:
        return f"http://127.0.0.1:{self.debug_port}"

    def wait_ready(self, timeout: float = 20.0) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                r = requests.get(f"{self._base()}/json/version", timeout=1.5, proxies=_NO_PROXY)
                if r.ok:
                    return
            except Exception:
                pass
            time.sleep(0.25)
        raise TimeoutError("Chrome DevTools port not ready")

    def _list_pages(self) -> list[dict]:
        targets = requests.get(f"{self._base()}/json/list", timeout=5, proxies=_NO_PROXY).json()
        return [t for t in targets if t.get("type") == "page"]

    def _close_target(self, target_id: str) -> None:
        try:
            requests.get(f"{self._base()}/json/close/{target_id}", timeout=3, proxies=_NO_PROXY)
        except Exception:
            pass

    @staticmethod
    def _is_blank_url(url: str | None) -> bool:
        u = (url or "").strip().lower()
        return (
            not u
            or u.startswith("about:blank")
            or u in ("about:newtab", "chrome://newtab/", "edge://newtab/")
            or u.startswith("chrome://new-tab-page")
            or u.startswith("edge://newtab")
        )

    def _pick_page(self, pages: list[dict], prefer_url: str | None) -> dict | None:
        if not pages:
            return None
        if prefer_url and not self._is_blank_url(prefer_url):
            key = _url_key(prefer_url)
            for t in pages:
                if key and key in _url_key(t.get("url") or ""):
                    return t
        # Prefer an already-open content tab over about:blank (blank popups are noise).
        content = [t for t in pages if not self._is_blank_url(t.get("url"))]
        if content:
            return content[0]
        return pages[0]

    def close_stray_blank_tabs(self, keep_id: str | None = None) -> int:
        """Close leftover about:blank pages so they don't flash as random windows."""
        keep = keep_id or self.target_id
        closed = 0
        for t in self._list_pages():
            tid = t.get("id")
            if not tid or tid == keep:
                continue
            if self._is_blank_url(t.get("url")):
                self._close_target(tid)
                closed += 1
        return closed

    def connect(
        self,
        prefer_url: str | None = None,
        solo_tab: bool = False,
        navigate: bool = False,
    ) -> None:
        """Attach to an existing tab. Never opens a random about:blank window.

        A new tab is created only if the browser has zero pages.
        """
        self.wait_ready()
        pages = self._list_pages()
        page = self._pick_page(pages, prefer_url)

        if not page:
            # Browser has no tabs yet (fresh kiosk) — open the intended URL once.
            from urllib.parse import quote

            target = prefer_url if prefer_url and not self._is_blank_url(prefer_url) else "about:blank"
            page = requests.put(
                f"{self._base()}/json/new?{quote(target, safe=':/?&=%#')}",
                timeout=5,
                proxies=_NO_PROXY,
            ).json()

        keep_id = page.get("id")
        if solo_tab and keep_id:
            for t in self._list_pages():
                tid = t.get("id")
                if tid and tid != keep_id:
                    self._close_target(tid)
        else:
            # Even without solo_tab, sweep blank leftovers from earlier reconnects.
            for t in self._list_pages():
                tid = t.get("id")
                if tid and tid != keep_id and self._is_blank_url(t.get("url")):
                    self._close_target(tid)

        ws_url = page["webSocketDebuggerUrl"]
        self.target_id = keep_id
        self.ws = create_connection(ws_url, timeout=10)
        self._alive = True
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()
        self.call("Page.enable")
        self.call("Runtime.enable")
        # Edge CDP often has no Input.enable (-32601). Mouse/key still work without it.
        try:
            self.call("Input.enable")
        except Exception:
            pass
        # Navigate in-place only when asked (cast / first launch), never on plain reconnect.
        if navigate and prefer_url:
            current = (page.get("url") or "").strip()
            if _url_key(current) != _url_key(prefer_url):
                try:
                    self.navigate(prefer_url)
                    time.sleep(0.3)
                except Exception:
                    pass

    def close(self) -> None:
        self.stop_screencast()
        self._alive = False
        try:
            if self.ws:
                self.ws.close()
        except Exception:
            pass

    def _read_loop(self) -> None:
        assert self.ws
        while self._alive:
            try:
                raw = self.ws.recv()
            except WebSocketConnectionClosedException:
                break
            except Exception:
                time.sleep(0.05)
                continue
            try:
                msg = json.loads(raw)
            except Exception:
                continue
            if "id" in msg:
                with self._lock:
                    self._pending[msg["id"]] = msg
            else:
                self._handle_event(msg)

    def _send_raw(self, method: str, params: dict | None = None) -> int:
        """Send a CDP command without waiting (safe from the reader thread)."""
        assert self.ws
        with self._lock:
            self._id += 1
            msg_id = self._id
            payload = {"id": msg_id, "method": method}
            if params:
                payload["params"] = params
            self.ws.send(json.dumps(payload))
            return msg_id

    def _handle_event(self, msg: dict) -> None:
        method = msg.get("method")
        params = msg.get("params") or {}
        if method == "Page.screencastFrame":
            data_b64 = params.get("data") or ""
            meta = params.get("metadata") or {}
            session_id = params.get("sessionId")
            try:
                raw = base64.b64decode(data_b64)
                self.frame_width = int(meta.get("deviceWidth") or self.frame_width)
                self.frame_height = int(meta.get("deviceHeight") or self.frame_height)
                if self.on_frame:
                    self.on_frame(raw, self.frame_width, self.frame_height)
            finally:
                # NEVER call() here — it deadlocks the reader thread waiting for its own reply.
                if session_id is not None:
                    try:
                        self._send_raw("Page.screencastFrameAck", {"sessionId": session_id})
                    except Exception:
                        pass

    def call(self, method: str, params: dict | None = None, timeout: float = 10.0) -> Any:
        assert self.ws
        msg_id = self._send_raw(method, params)
        deadline = time.time() + timeout
        while time.time() < deadline:
            with self._lock:
                if msg_id in self._pending:
                    resp = self._pending.pop(msg_id)
                    if "error" in resp:
                        raise RuntimeError(f"CDP {method}: {resp['error']}")
                    return resp.get("result")
            time.sleep(0.01)
        raise TimeoutError(f"CDP timeout: {method}")

    def navigate(self, url: str) -> None:
        self.call("Page.navigate", {"url": url})

    def _refresh_metrics(self) -> None:
        try:
            metrics = self.call("Page.getLayoutMetrics", timeout=3.0) or {}
            box = (
                metrics.get("cssVisualViewport")
                or metrics.get("cssLayoutViewport")
                or metrics.get("layoutViewport")
                or {}
            )
            w = int(box.get("clientWidth") or box.get("width") or 0)
            h = int(box.get("clientHeight") or box.get("height") or 0)
            if w > 0 and h > 0:
                self.frame_width = w
                self.frame_height = h
        except Exception:
            pass

    def _screenshot_loop(self) -> None:
        """Poll screenshots — Edge kiosk often stops Page.screencast after visibility=false."""
        while self._shot_alive and self._alive:
            try:
                self._refresh_metrics()
                result = self.call(
                    "Page.captureScreenshot",
                    {"format": "jpeg", "quality": 45, "fromSurface": True},
                    timeout=5.0,
                ) or {}
                data_b64 = result.get("data") or ""
                if data_b64 and self.on_frame:
                    raw = base64.b64decode(data_b64)
                    if raw:
                        self.on_frame(raw, self.frame_width, self.frame_height)
            except Exception:
                time.sleep(0.6)
                continue
            time.sleep(0.35)

    def start_screencast(self) -> None:
        """Start frame capture (screenshot polling; name kept for agent compatibility)."""
        try:
            self.call("Page.bringToFront")
        except Exception:
            pass
        # Best-effort live screencast; screenshot loop is the reliable path for TV kiosk.
        try:
            self.call(
                "Page.startScreencast",
                {
                    "format": "jpeg",
                    "quality": 35,
                    "maxWidth": 800,
                    "maxHeight": 450,
                    "everyNthFrame": 2,
                },
            )
        except Exception:
            pass
        if self._shot_alive:
            return
        self._shot_alive = True
        self._shot_thread = threading.Thread(target=self._screenshot_loop, daemon=True)
        self._shot_thread.start()

    def stop_screencast(self) -> None:
        self._shot_alive = False
        try:
            self.call("Page.stopScreencast")
        except Exception:
            pass

    def mouse(self, phase: str, x: float, y: float, click: bool = False, double: bool = False) -> None:
        typ = {"down": "mousePressed", "up": "mouseReleased", "move": "mouseMoved"}.get(phase, "mouseMoved")
        click_count = 2 if double else 1
        if phase == "move":
            click_count = 0
        params = {
            "type": typ,
            "x": float(x),
            "y": float(y),
            "button": "left" if phase in ("down", "up") else "none",
            "buttons": 1 if phase == "down" else 0,
            "clickCount": click_count if phase in ("down", "up") else 0,
        }
        self.call("Input.dispatchMouseEvent", params)
        # Some sites need an explicit click sequence if only "up" arrived
        if click and phase == "up" and not double:
            pass

    def scroll(self, x: float, y: float, dx: float, dy: float) -> None:
        self.call(
            "Input.dispatchMouseEvent",
            {
                "type": "mouseWheel",
                "x": float(x),
                "y": float(y),
                "deltaX": float(dx),
                "deltaY": float(dy),
            },
        )

    def insert_text(self, text: str) -> None:
        self.call("Input.insertText", {"text": text})

    def key(self, key: str) -> None:
        vk = {
            "Enter": 13,
            " ": 32,
            "ArrowLeft": 37,
            "ArrowUp": 38,
            "ArrowRight": 39,
            "ArrowDown": 40,
            "Escape": 27,
            "Backspace": 8,
        }.get(key, 0)
        code = key if key.startswith("Arrow") else ("Space" if key == " " else key)
        for typ in ("keyDown", "keyUp"):
            self.call(
                "Input.dispatchKeyEvent",
                {
                    "type": typ,
                    "key": key,
                    "code": code,
                    "windowsVirtualKeyCode": vk,
                    "nativeVirtualKeyCode": vk,
                    "text": key if len(key) == 1 else "",
                    "unmodifiedText": key if len(key) == 1 else "",
                },
            )

    def history_back(self) -> None:
        hist = self.call("Page.getNavigationHistory")
        idx = int(hist.get("currentIndex") or 0)
        entries = hist.get("entries") or []
        if idx > 0:
            self.call("Page.navigateToHistoryEntry", {"entryId": entries[idx - 1]["id"]})

    def reload(self) -> None:
        self.call("Page.reload", {"ignoreCache": False})
