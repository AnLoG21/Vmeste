import { useEffect, useRef, useState } from "react";

export default function VefireRemote({ authFetch, API_URL, onBack }) {
  const imgRef = useRef(null);
  const inputRef = useRef(null);
  const [meta, setMeta] = useState({ width: 1280, height: 720 });
  const [status, setStatus] = useState("…");
  const [text, setText] = useState("");
  const [failHint, setFailHint] = useState("");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const dragRef = useRef({ on: false, x: 0, y: 0, lastTap: 0, moved: false });
  const blobUrlRef = useRef("");
  const missesRef = useRef(0);
  const textRef = useRef("");
  const pollBusyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tick() {
      if (pollBusyRef.current) {
        if (!cancelled) timer = setTimeout(tick, 40);
        return;
      }
      pollBusyRef.current = true;
      try {
        const res = await authFetch(`${API_URL}/vefire/agent/frame/`);
        if (!res.ok) {
          missesRef.current += 1;
          if (!cancelled) {
            setStatus("нет картинки");
            if (missesRef.current > 10) {
              setFailHint("Перезапусти run.bat на ноуте у ТВ.");
            }
            if (missesRef.current === 3 || missesRef.current % 20 === 0) {
              try {
                const hb = await authFetch(`${API_URL}/vefire/agent/heartbeat/`);
                if (hb.ok) {
                  const a = (await hb.json())?.agent;
                  if (a?.frame_width && a?.frame_height) {
                    setMeta({ width: a.frame_width, height: a.frame_height });
                  }
                  if (a && a.online === false) setFailHint("Агент офлайн — run.bat на ноуте.");
                }
              } catch {
                /* ignore */
              }
            }
          }
        } else {
          missesRef.current = 0;
          setFailHint("");
          const blob = await res.blob();
          const w = Number(res.headers.get("X-Frame-Width") || 0);
          const h = Number(res.headers.get("X-Frame-Height") || 0);
          if (w && h) setMeta({ width: w, height: h });
          const url = URL.createObjectURL(blob);
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = url;
          if (imgRef.current) imgRef.current.src = url;
          if (!cancelled) setStatus("онлайн");
        }
      } catch {
        if (!cancelled) setStatus("нет API");
      } finally {
        pollBusyRef.current = false;
        if (!cancelled) timer = setTimeout(tick, 90);
      }
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [authFetch, API_URL]);

  function send(body) {
    // Fire-and-forget — awaiting every tap added hundreds of ms of lag.
    authFetch(`${API_URL}/vefire/agent/input/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  }

  function mapPoint(clientX, clientY) {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = ((clientX - rect.left) / rect.width) * meta.width;
    const y = ((clientY - rect.top) / rect.height) * meta.height;
    if (x < 0 || y < 0 || x > meta.width || y > meta.height) return null;
    return { x, y };
  }

  function openKeyboard() {
    setKeyboardOpen(true);
    // iOS/Android need focus in the same user gesture when possible; retry shortly.
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: false });
    });
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function onPointerDown(e) {
    const p = mapPoint(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { ...dragRef.current, on: true, x: p.x, y: p.y, moved: false };
    send({ type: "pointer", phase: "down", x: p.x, y: p.y });
  }

  function onPointerMove(e) {
    if (!dragRef.current.on) return;
    const p = mapPoint(e.clientX, e.clientY);
    if (!p) return;
    const dy = p.y - dragRef.current.y;
    const dx = p.x - dragRef.current.x;
    if (Math.abs(dy) > 4 || Math.abs(dx) > 4) {
      dragRef.current.moved = true;
      send({ type: "scroll", dx, dy: -dy * 1.6, x: p.x, y: p.y });
      dragRef.current.x = p.x;
      dragRef.current.y = p.y;
    }
  }

  function onPointerUp(e) {
    if (!dragRef.current.on) return;
    dragRef.current.on = false;
    const p = mapPoint(e.clientX, e.clientY) || { x: dragRef.current.x, y: dragRef.current.y };
    const now = Date.now();
    const dbl = now - dragRef.current.lastTap < 320;
    dragRef.current.lastTap = now;
    send({ type: "pointer", phase: "up", x: p.x, y: p.y, click: true, double: dbl });
    // After a short tap on the screen, offer the phone keyboard for search fields.
    if (!dragRef.current.moved && !dbl) {
      openKeyboard();
    }
  }

  function onTextChange(e) {
    const next = e.target.value;
    const prev = textRef.current;
    textRef.current = next;
    setText(next);
    if (next.length > prev.length) {
      send({ type: "text", text: next.slice(prev.length) });
    } else if (next.length < prev.length) {
      const n = prev.length - next.length;
      for (let i = 0; i < n; i += 1) send({ type: "key", key: "Backspace" });
    }
  }

  function submitText() {
    send({ type: "key", key: "Enter" });
    textRef.current = "";
    setText("");
  }

  return (
    <section className="vefire-shell vefire-remote">
      <header className="vefire-remote-bar">
        <button type="button" className="vefire-remote-bar-btn" onClick={onBack}>
          ←
        </button>
        <span className="vefire-remote-bar-status">{status}</span>
        <button type="button" className="vefire-remote-bar-btn" onClick={openKeyboard}>
          ⌨
        </button>
      </header>

      <div className="vefire-remote-stage">
        <img
          ref={imgRef}
          alt="Экран ТВ"
          className="vefire-remote-frame"
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      {failHint ? <p className="vefire-remote-hint">{failHint}</p> : null}

      <div className={`vefire-remote-keys ${keyboardOpen ? "is-open" : ""}`}>
        <input
          ref={inputRef}
          className="vefire-remote-type"
          value={text}
          onChange={onTextChange}
          onFocus={() => setKeyboardOpen(true)}
          onBlur={() => setKeyboardOpen(false)}
          placeholder="Печатай — уходит на ТВ"
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submitText();
            }
          }}
        />
        <button type="button" className="vefire-remote-enter" onClick={submitText}>
          Enter
        </button>
      </div>
    </section>
  );
}
