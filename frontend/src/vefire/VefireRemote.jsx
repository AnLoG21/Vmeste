import { useEffect, useRef, useState } from "react";

export default function VefireRemote({ authFetch, API_URL, onBack }) {
  const imgRef = useRef(null);
  const [meta, setMeta] = useState({ width: 1280, height: 720 });
  const [status, setStatus] = useState("подключение…");
  const [text, setText] = useState("");
  const dragRef = useRef({ on: false, x: 0, y: 0, lastTap: 0 });
  const blobUrlRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tick() {
      try {
        const res = await authFetch(`${API_URL}/vefire/agent/frame/`);
        if (!res.ok) {
          if (!cancelled) setStatus("ждём картинку с ноута…");
        } else {
          const blob = await res.blob();
          const w = Number(res.headers.get("X-Frame-Width") || 0);
          const h = Number(res.headers.get("X-Frame-Height") || 0);
          if (w && h) setMeta({ width: w, height: h });
          const url = URL.createObjectURL(blob);
          if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = url;
          if (imgRef.current) imgRef.current.src = url;
          if (!cancelled) setStatus("онлайн · ТВ");
        }
      } catch {
        if (!cancelled) setStatus("нет связи");
      }
      if (!cancelled) timer = setTimeout(tick, 280);
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [authFetch, API_URL]);

  async function send(body) {
    try {
      await authFetch(`${API_URL}/vefire/agent/input/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* ignore */
    }
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

  function onPointerDown(e) {
    const p = mapPoint(e.clientX, e.clientY);
    if (!p) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { ...dragRef.current, on: true, x: p.x, y: p.y };
    send({ type: "pointer", phase: "down", x: p.x, y: p.y });
  }

  function onPointerMove(e) {
    if (!dragRef.current.on) return;
    const p = mapPoint(e.clientX, e.clientY);
    if (!p) return;
    const dy = p.y - dragRef.current.y;
    const dx = p.x - dragRef.current.x;
    if (Math.abs(dy) > 6 || Math.abs(dx) > 6) {
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
  }

  return (
    <section className="vefire-shell vefire-remote">
      <header className="vefire-top">
        <button type="button" className="vefire-back" onClick={onBack}>
          ← Лаунчер
        </button>
        <div className="vefire-brand">
          <span>Пульт ТВ</span>
        </div>
        <span className="vefire-clock">{status}</span>
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

      <div className="vefire-remote-dock">
        <p className="vefire-muted">Тап = клик · свайп = скролл · текст уходит в поиск на ТВ</p>
        <div className="vefire-link-row">
          <button type="button" className="vefire-btn" onClick={() => send({ type: "nav", action: "back" })}>
            ← Назад
          </button>
          <button type="button" className="vefire-btn" onClick={() => send({ type: "nav", action: "home" })}>
            Домой
          </button>
          <button type="button" className="vefire-btn" onClick={() => send({ type: "nav", action: "reload" })}>
            ↻
          </button>
        </div>
        <div className="vefire-link-row">
          <input
            className="vefire-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Поиск / текст"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                send({ type: "text", text });
                setText("");
              }
            }}
          />
          <button
            type="button"
            className="vefire-btn vefire-btn--accent"
            onClick={() => {
              send({ type: "text", text });
              setText("");
            }}
          >
            Ввод
          </button>
        </div>
        <div className="vefire-link-row">
          <button type="button" className="vefire-btn" onClick={() => send({ type: "key", key: "ArrowLeft" })}>
            ◀
          </button>
          <button type="button" className="vefire-btn" onClick={() => send({ type: "key", key: "ArrowRight" })}>
            ▶
          </button>
          <button type="button" className="vefire-btn" onClick={() => send({ type: "key", key: " " })}>
            Пробел
          </button>
          <button type="button" className="vefire-btn" onClick={() => send({ type: "key", key: "Enter" })}>
            Enter
          </button>
        </div>
      </div>
    </section>
  );
}
