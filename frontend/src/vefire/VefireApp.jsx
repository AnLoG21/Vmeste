import { useEffect, useMemo, useState } from "react";
import "./vefire.css";
import VefireLogo from "./VefireLogo.jsx";
import { VEFIRE_APPS, VEFIRE_SEARCH_TARGETS } from "./vefireApps.js";
import { canAccessVefire } from "./vefireAccess.js";
import { castToTv, fetchAgentStatus, fetchLatestCast } from "./vefireApi.js";
import VefireRemote from "./VefireRemote.jsx";

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg|m3u8)(\?|#|$)/i.test(url);
}

function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  // eslint-disable-next-line no-new
  new URL(url);
  return url;
}

export default function VefireApp({ me, authFetch, API_URL, onExit }) {
  const allowed = canAccessVefire(me);
  const [activeAppId, setActiveAppId] = useState(null);
  const [linkInput, setLinkInput] = useState("");
  const [playerUrl, setPlayerUrl] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [castBusy, setCastBusy] = useState(false);
  const [castMsg, setCastMsg] = useState("");
  const [latestCast, setLatestCast] = useState(null);
  const [agent, setAgent] = useState(null);
  const [showRemote, setShowRemote] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTarget, setSearchTarget] = useState("youtube");

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!allowed && typeof onExit === "function") onExit();
  }, [allowed, onExit]);

  useEffect(() => {
    if (!allowed || !authFetch || !API_URL) return undefined;
    let cancelled = false;
    async function load() {
      try {
        const [job, ag] = await Promise.all([
          fetchLatestCast(authFetch, API_URL),
          fetchAgentStatus(authFetch, API_URL),
        ]);
        if (!cancelled) {
          setLatestCast(job);
          setAgent(ag);
        }
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [allowed, authFetch, API_URL]);

  const activeApp = useMemo(
    () => VEFIRE_APPS.find((a) => a.id === activeAppId) || null,
    [activeAppId]
  );

  async function sendToTv(url, title = "") {
    if (!authFetch || !API_URL) {
      setCastMsg("Нет API для cast");
      return;
    }
    setCastBusy(true);
    setCastMsg("Отправляю на ТВ…");
    try {
      const job = await castToTv(authFetch, API_URL, { url, title });
      setLatestCast(job);
      setCastMsg("Отправлено. Агент на ноуте откроет через пару секунд.");
    } catch (e) {
      setCastMsg(e?.message || "Ошибка отправки");
    } finally {
      setCastBusy(false);
    }
  }

  if (!allowed) {
    return (
      <section className="vefire-shell vefire-shell--denied cabinet-sheet">
        <p>Вэфире доступен только на тестовом аккаунте.</p>
        <button type="button" className="vefire-btn" onClick={onExit}>
          Назад к сервисам
        </button>
      </section>
    );
  }

  function openExternal(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function openApp(app) {
    setCastMsg("");
    setActiveAppId(app.id);
    setPlayerUrl("");
  }

  async function castSearch({ openRemote = true } = {}) {
    const q = searchQuery.trim();
    if (!q) {
      setCastMsg("Введи что искать");
      return;
    }
    const target = VEFIRE_SEARCH_TARGETS.find((t) => t.id === searchTarget) || VEFIRE_SEARCH_TARGETS[0];
    const url = target.build(q);
    await sendToTv(url, `${target.title}: ${q}`);
    if (openRemote) setShowRemote(true);
  }

  function launchLink({ toTv = false } = {}) {
    let normalized = "";
    try {
      normalized = normalizeUrl(linkInput);
    } catch {
      setCastMsg("Некорректная ссылка");
      return;
    }
    if (!normalized) return;
    if (toTv) {
      sendToTv(normalized, "Ссылка");
      return;
    }
    if (isDirectVideoUrl(normalized)) {
      setPlayerUrl(normalized);
      return;
    }
    openExternal(normalized);
  }

  const castStatusLine = latestCast
    ? `Последний cast #${latestCast.id}: ${latestCast.status}${latestCast.title ? ` · ${latestCast.title}` : ""}`
    : "Агент на ноуте пока молчит — запусти Vefire-TV-Agent на рабочем столе";

  const agentLine = agent?.online
    ? "Агент онлайн — можно открыть пульт здесь"
    : "Агент офлайн — запусти run.bat на ноуте у ТВ";

  if (showRemote) {
    return (
      <VefireRemote
        authFetch={authFetch}
        API_URL={API_URL}
        onBack={() => setShowRemote(false)}
      />
    );
  }

  if (activeApp?.kind === "find") {
    return (
      <section className="vefire-shell cabinet-sheet">
        <header className="vefire-top">
          <button type="button" className="vefire-back" onClick={() => setActiveAppId(null)}>
            ← Лаунчер
          </button>
          <div className="vefire-brand">
            <VefireLogo size={28} />
            <span>Найти видео</span>
          </div>
          <span className="vefire-clock">
            {clock.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </header>
        <div className="vefire-link-panel">
          <h2>Поиск на ТВ</h2>
          <p className="vefire-muted">
            Введи запрос — ноут откроет поиск на телевизоре. Дальше пульт: выбери ролик и −15 / ▶ / +15.
          </p>
          <div className="vefire-search-targets">
            {VEFIRE_SEARCH_TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`vefire-chip ${searchTarget === t.id ? "is-active" : ""}`}
                onClick={() => setSearchTarget(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
          <div className="vefire-link-row">
            <input
              className="vefire-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Фильм, клип, шоу…"
              enterKeyHint="search"
              onKeyDown={(e) => {
                if (e.key === "Enter") castSearch();
              }}
            />
            <button
              type="button"
              className="vefire-btn vefire-btn--accent"
              disabled={castBusy}
              onClick={() => castSearch()}
            >
              На ТВ
            </button>
          </div>
          <button
            type="button"
            className="vefire-btn"
            onClick={() => {
              const q = searchQuery.trim();
              if (!q) return;
              const target = VEFIRE_SEARCH_TARGETS.find((t) => t.id === searchTarget) || VEFIRE_SEARCH_TARGETS[0];
              openExternal(target.build(q));
            }}
          >
            Сначала найти в браузере телефона
          </button>
          <p className="vefire-hint">
            Из YouTube/RuTube на телефоне: Поделиться → Копировать ссылку → раздел «Ссылка» → На ТВ.
          </p>
          {castMsg ? <p className="vefire-cast-msg">{castMsg}</p> : null}
          <p className="vefire-muted vefire-cast-status">{agentLine}</p>
          <button type="button" className="vefire-btn vefire-btn--accent" onClick={() => setShowRemote(true)}>
            Пульт
          </button>
        </div>
      </section>
    );
  }

  if (activeApp?.kind === "link") {
    return (
      <section className="vefire-shell cabinet-sheet">
        <header className="vefire-top">
          <button type="button" className="vefire-back" onClick={() => setActiveAppId(null)}>
            ← Лаунчер
          </button>
          <div className="vefire-brand">
            <VefireLogo size={28} />
            <span>Ссылка</span>
          </div>
          <span className="vefire-clock">
            {clock.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </header>
        <div className="vefire-link-panel">
          <h2>Ссылка с телефона → ТВ</h2>
          <p className="vefire-muted">
            Скопируй ссылку из YouTube / RuTube / браузера и отправь на телевизор. Прямой mp4 можно смотреть и здесь.
          </p>
          <div className="vefire-link-row">
            <input
              className="vefire-input"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://…"
              onKeyDown={(e) => {
                if (e.key === "Enter") launchLink({ toTv: true });
              }}
            />
            <button
              type="button"
              className="vefire-btn vefire-btn--accent"
              disabled={castBusy}
              onClick={() => {
                launchLink({ toTv: true });
                setShowRemote(true);
              }}
            >
              На ТВ
            </button>
          </div>
          {castMsg ? <p className="vefire-cast-msg">{castMsg}</p> : null}
          <p className="vefire-muted vefire-cast-status">{castStatusLine}</p>
          <p className="vefire-muted vefire-cast-status">{agentLine}</p>
          <button
            type="button"
            className="vefire-btn vefire-btn--accent"
            onClick={() => setShowRemote(true)}
          >
            Пульт
          </button>
          {playerUrl ? (
            <div className="vefire-player-wrap">
              <video className="vefire-player" src={playerUrl} controls autoPlay playsInline />
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (activeApp) {
    return (
      <section className="vefire-shell cabinet-sheet">
        <header className="vefire-top">
          <button type="button" className="vefire-back" onClick={() => setActiveAppId(null)}>
            ← Лаунчер
          </button>
          <div className="vefire-brand">
            <span className="vefire-app-dot" style={{ background: activeApp.accent }} />
            <span>{activeApp.title}</span>
          </div>
          <span className="vefire-clock">
            {clock.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </header>
        <div className="vefire-app-stage">
          <div
            className="vefire-app-hero"
            style={{
              background: `radial-gradient(circle at 30% 20%, ${activeApp.accent}55, transparent 55%), #12151c`,
            }}
          >
            <div className="vefire-app-hero-icon" style={{ background: activeApp.accent }}>
              {activeApp.letter}
            </div>
            <h2>{activeApp.title}</h2>
            <p>{activeApp.subtitle}</p>
            <div className="vefire-app-actions">
              <button
                type="button"
                className="vefire-btn vefire-btn--accent"
                disabled={castBusy}
                onClick={() => sendToTv(activeApp.url, activeApp.title)}
              >
                На ТВ
              </button>
              <button type="button" className="vefire-btn" onClick={() => openExternal(activeApp.url)}>
                Открыть здесь
              </button>
              <button type="button" className="vefire-btn" onClick={() => setActiveAppId(null)}>
                Назад
              </button>
            </div>
            {castMsg ? <p className="vefire-cast-msg">{castMsg}</p> : null}
            <p className="vefire-hint">
              «На ТВ» → агент на ноуте. Потом «Открыть пульт» — зеркало экрана и управление с телефона.
            </p>
            <p className="vefire-muted vefire-cast-status">{castStatusLine}</p>
            <p className="vefire-muted vefire-cast-status">{agentLine}</p>
            <button type="button" className="vefire-btn vefire-btn--accent" onClick={() => setShowRemote(true)}>
              Пульт
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="vefire-shell cabinet-sheet">
      <header className="vefire-top">
        <button type="button" className="vefire-back" onClick={onExit}>
          ← Сервисы
        </button>
        <div className="vefire-brand">
          <VefireLogo size={28} />
          <span>Вэфире</span>
        </div>
        <span className="vefire-clock">
          {clock.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </header>

      <div className="vefire-home">
        <p className="vefire-eyebrow">Домашний экран</p>
        <h1 className="vefire-title">Что смотрим?</h1>
        <p className="vefire-muted vefire-cast-status">{castStatusLine}</p>
        <p className="vefire-muted vefire-cast-status">{agentLine}</p>
        <div className="vefire-app-actions" style={{ marginBottom: "0.5rem" }}>
          <button type="button" className="vefire-btn vefire-btn--accent" onClick={() => setShowRemote(true)}>
            Пульт
          </button>
        </div>
        <div className="vefire-grid">
          {VEFIRE_APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              className="vefire-tile"
              onClick={() => openApp(app)}
              style={{ "--tile-accent": app.accent }}
            >
              <span className="vefire-tile-icon" style={{ background: app.accent }}>
                {app.letter}
              </span>
              <span className="vefire-tile-title">{app.title}</span>
              <span className="vefire-tile-sub">{app.subtitle}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
