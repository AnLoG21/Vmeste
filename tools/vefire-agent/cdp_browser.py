"""Minimal Chrome/Edge DevTools Protocol client for navigate + screencast + input."""
from __future__ import annotations

import json
import threading
import time
from typing import Any, Callable

import requests

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


class CdpBrowser:
    def __init__(self, debug_port: int = 9222):
        self.debug_port = debug_port
        self.ws = None
        self._id = 0
        self._lock = threading.Lock()
        self._pending: dict[int, dict] = {}
        self._events: list[dict] = []
        self._reader: threading.Thread | None = None
        self._alive = False
        self.frame_width = 1280
        self.frame_height = 720
        self.on_frame: Callable[[bytes, int, int], None] | None = None
        self._session_id: str | None = None

    def _base(self) -> str:
        return f"http://127.0.0.1:{self.debug_port}"

    def wait_ready(self, timeout: float = 20.0) -> None:
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                r = requests.get(f"{self._base()}/json/version", timeout=1.5)
                if r.ok:
                    return
            except Exception:
                pass
            time.sleep(0.25)
        raise TimeoutError("Chrome DevTools port not ready")

    def connect(self) -> None:
        self.wait_ready()
        targets = requests.get(f"{self._base()}/json/list", timeout=5).json()
        page = next((t for t in targets if t.get("type") == "page"), None)
        if not page:
            # create a blank tab via /json/new
            page = requests.put(f"{self._base()}/json/new?about:blank", timeout=5).json()
        ws_url = page["webSocketDebuggerUrl"]
        self.ws = create_connection(ws_url, timeout=10)
        self._alive = True
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call("Input.enable")

    def close(self) -> None:
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

    def _handle_event(self, msg: dict) -> None:
        method = msg.get("method")
        params = msg.get("params") or {}
        if method == "Page.screencastFrame":
            data_b64 = params.get("data") or ""
            meta = params.get("metadata") or {}
            session_id = params.get("sessionId")
            try:
                import base64

                raw = base64.b64decode(data_b64)
                self.frame_width = int(meta.get("deviceWidth") or self.frame_width)
                self.frame_height = int(meta.get("deviceHeight") or self.frame_height)
                if self.on_frame:
                    self.on_frame(raw, self.frame_width, self.frame_height)
            finally:
                if session_id is not None:
                    try:
                        self.call("Page.screencastFrameAck", {"sessionId": session_id})
                    except Exception:
                        pass

    def call(self, method: str, params: dict | None = None, timeout: float = 10.0) -> Any:
        assert self.ws
        with self._lock:
            self._id += 1
            msg_id = self._id
            payload = {"id": msg_id, "method": method}
            if params:
                payload["params"] = params
            self.ws.send(json.dumps(payload))
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

    def start_screencast(self) -> None:
        self.call(
            "Page.startScreencast",
            {
                "format": "jpeg",
                "quality": 40,
                "maxWidth": 854,
                "maxHeight": 480,
                "everyNthFrame": 2,
            },
        )

    def stop_screencast(self) -> None:
        try:
            self.call("Page.stopScreencast")
        except Exception:
            pass

    def mouse(self, phase: str, x: float, y: float, click: bool = False, double: bool = False) -> None:
        typ = {"down": "mousePressed", "up": "mouseReleased", "move": "mouseMoved"}.get(phase, "mouseMoved")
        params = {
            "type": typ,
            "x": float(x),
            "y": float(y),
            "button": "left" if phase in ("down", "up") else "none",
            "clickCount": 2 if double and phase == "up" else (1 if phase in ("down", "up") else 0),
        }
        self.call("Input.dispatchMouseEvent", params)
        if click and phase == "up" and not double:
            # ensure click registered
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
        # Best-effort key events for navigation keys
        self.call(
            "Input.dispatchKeyEvent",
            {"type": "keyDown", "key": key, "code": key if key.startswith("Arrow") else key, "windowsVirtualKeyCode": 0},
        )
        self.call(
            "Input.dispatchKeyEvent",
            {"type": "keyUp", "key": key, "code": key if key.startswith("Arrow") else key, "windowsVirtualKeyCode": 0},
        )

    def history_back(self) -> None:
        hist = self.call("Page.getNavigationHistory")
        idx = int(hist.get("currentIndex") or 0)
        entries = hist.get("entries") or []
        if idx > 0:
            self.call("Page.navigateToHistoryEntry", {"entryId": entries[idx - 1]["id"]})

    def reload(self) -> None:
        self.call("Page.reload", {"ignoreCache": False})
