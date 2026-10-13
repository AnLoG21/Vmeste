import { useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "./config.js";
import "./lubimaya.css";

const TRANSITION_MS = 420;

const PHOTO_POOL = Array.from({ length: 12 }, (_, i) => `/lubimaya/photo-${String(i + 1).padStart(2, "0")}.jpg`);

const COLLAGE_SLOTS = [
  { top: "4%", left: "2%", rotate: -14, w: 118 },
  { top: "12%", right: "3%", rotate: 11, w: 132 },
  { bottom: "18%", left: "1%", rotate: 8, w: 110 },
  { bottom: "8%", right: "2%", rotate: -9, w: 124 },
  { top: "38%", left: "0%", rotate: -6, w: 96 },
  { top: "42%", right: "0%", rotate: 15, w: 102 },
];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickCollage(seedKey) {
  // re-roll layout whenever scene changes
  void seedKey;
  const photos = shuffle(PHOTO_POOL).slice(0, 5 + Math.floor(Math.random() * 2));
  const slots = shuffle(COLLAGE_SLOTS).slice(0, photos.length);
  return photos.map((src, i) => {
    const slot = slots[i];
    const jitter = () => (Math.random() * 10 - 5).toFixed(1);
    return {
      src,
      style: {
        top: slot.top,
        left: slot.left,
        right: slot.right,
        bottom: slot.bottom,
        width: `${slot.w + Math.round(Math.random() * 18 - 6)}px`,
        ["--lm-rot"]: `${slot.rotate + Number(jitter())}deg`,
        animationDelay: `${(i * 0.12).toFixed(2)}s`,
      },
      key: `${seedKey}-${src}-${i}`,
    };
  });
}

function PhotoCollage({ scene }) {
  const items = useMemo(() => pickCollage(scene), [scene]);
  return (
    <div className="lubimaya-collage" aria-hidden="true">
      {items.map((item) => (
        <figure key={item.key} className="lubimaya-polaroid" style={item.style}>
          <img src={item.src} alt="" loading="lazy" draggable={false} />
        </figure>
      ))}
    </div>
  );
}

function Heart3D() {
  return (
    <div className="lubimaya-heart" aria-hidden="true">
      <div className="lubimaya-heart-glow" />
      <div className="lubimaya-heart-face lubimaya-heart-face--front">
        <span />
        <span />
      </div>
      <div className="lubimaya-heart-face lubimaya-heart-face--back">
        <span />
        <span />
      </div>
    </div>
  );
}

async function notifyTelegram({ scenario, answer, step }) {
  try {
    await fetch(`${API_URL}/users/private-scenario-reply/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: "lubimaya_arinochka",
        scenario,
        answer,
        step,
      }),
    });
  } catch {
    /* soft-fail: UI must stay romantic even if notify fails */
  }
}

export default function LubimayaPage() {
  const [scene, setScene] = useState("intro");
  const [leaving, setLeaving] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  const [otherText, setOtherText] = useState("");
  const [whyText, setWhyText] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const timers = useRef([]);

  useEffect(() => {
    document.title = "Для тебя";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (scene !== "intro") return undefined;
    setIntroStep(0);
    const delays = [400, 2800, 4200, 6000, 7800];
    delays.forEach((ms, i) => {
      const id = setTimeout(() => setIntroStep(i + 1), ms);
      timers.current.push(id);
    });
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [scene]);

  function go(next) {
    if (leaving) return;
    setLeaving(true);
    const id = setTimeout(() => {
      setScene(next);
      setLeaving(false);
      setStatus("");
      setOtherText("");
      setWhyText("");
    }, TRANSITION_MS);
    timers.current.push(id);
  }

  async function onChoice({ scenario, answer, step, next }) {
    setBusy(true);
    await notifyTelegram({ scenario, answer, step });
    setBusy(false);
    if (next) go(next);
  }

  async function onSubmitText({ scenario, answer, step, next }) {
    const text = (answer || "").trim();
    if (!text) {
      setStatus("Напиши хотя бы пару слов…");
      return;
    }
    setBusy(true);
    setStatus("Отправляю…");
    await notifyTelegram({ scenario, answer: text, step });
    setBusy(false);
    setStatus("");
    go(next);
  }

  const stageClass = `lubimaya-stage${leaving ? " is-leaving" : ""}`;

  return (
    <main className="lubimaya">
      <div className="lubimaya-orb lubimaya-orb--a" />
      <div className="lubimaya-orb lubimaya-orb--b" />
      <PhotoCollage scene={scene} />
      <div className="lubimaya-shell">
        {scene === "intro" ? (
          <section className={stageClass} aria-live="polite">
            <h1 className="lubimaya-draw">Прости меня, Любимая</h1>

            <div className={`lubimaya-heart-scene${introStep >= 1 ? " is-in" : ""}`}>
              <Heart3D />
            </div>

            <p className={`lubimaya-line${introStep >= 2 ? " is-in" : ""}`}>
              Я буду делиться с тобой со всем, какой бы ни был исход
            </p>
            <p className={`lubimaya-line${introStep >= 3 ? " is-in" : ""}`}>
              Твоя поддержка для меня самая важная, как и каждое слово которое ты говоришь
            </p>
            <h2 className={`lubimaya-question${introStep >= 4 ? " is-in" : ""}`}>
              Сможешь ли ты меня простить?
            </h2>

            <div className={`lubimaya-actions${introStep >= 5 ? " is-in" : ""}`}>
              <button
                type="button"
                className="lubimaya-btn lubimaya-btn--yes"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Сможешь ли ты меня простить?",
                    answer: "Да",
                    step: "forgive",
                    next: "sure",
                  })
                }
              >
                Да
              </button>
              <button
                type="button"
                className="lubimaya-btn"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Сможешь ли ты меня простить?",
                    answer: "Нет",
                    step: "forgive",
                    next: "please",
                  })
                }
              >
                Нет
              </button>
              <button
                type="button"
                className="lubimaya-btn lubimaya-btn--ghost"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Сможешь ли ты меня простить?",
                    answer: "Другой ответ",
                    step: "forgive",
                    next: "other",
                  })
                }
              >
                Другой ответ
              </button>
            </div>
          </section>
        ) : null}

        {scene === "sure" ? (
          <section className={stageClass} aria-live="polite">
            <h2 className="lubimaya-draw lubimaya-draw--sm is-ready">Точно?</h2>
            <div className="lubimaya-actions is-in">
              <button
                type="button"
                className="lubimaya-btn lubimaya-btn--yes"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Точно?",
                    answer: "Да",
                    step: "sure",
                    next: "thanks",
                  })
                }
              >
                Да
              </button>
              <button
                type="button"
                className="lubimaya-btn"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Точно?",
                    answer: "Нет",
                    step: "sure",
                    next: "please",
                  })
                }
              >
                Нет
              </button>
            </div>
          </section>
        ) : null}

        {scene === "please" ? (
          <section className={stageClass} aria-live="polite">
            <h2 className="lubimaya-draw lubimaya-draw--sm is-ready">Ну пожалуйста</h2>
            <div className="lubimaya-heart-scene is-in">
              <Heart3D />
            </div>
            <div className="lubimaya-actions is-in">
              <button
                type="button"
                className="lubimaya-btn lubimaya-btn--yes"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Ну пожалуйста",
                    answer: "Да",
                    step: "please",
                    next: "sure",
                  })
                }
              >
                Да
              </button>
              <button
                type="button"
                className="lubimaya-btn"
                disabled={busy}
                onClick={() =>
                  onChoice({
                    scenario: "Ну пожалуйста",
                    answer: "Нет",
                    step: "please",
                    next: "why",
                  })
                }
              >
                Нет
              </button>
            </div>
          </section>
        ) : null}

        {scene === "other" ? (
          <section className={stageClass} aria-live="polite">
            <h2 className="lubimaya-draw lubimaya-draw--sm is-ready">Другой ответ</h2>
            <p className="lubimaya-line is-in">Напиши, что чувствуешь — я прочитаю.</p>
            <form
              className="lubimaya-form is-in"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitText({
                  scenario: "Сможешь ли ты меня простить? → Другой ответ",
                  answer: otherText,
                  step: "other",
                  next: "received",
                });
              }}
            >
              <textarea
                className="lubimaya-input"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Твой ответ…"
                maxLength={2000}
                required
              />
              <div className="lubimaya-form-row">
                <button type="submit" className="lubimaya-btn lubimaya-btn--send" disabled={busy}>
                  Отправить
                </button>
              </div>
              {status ? <p className="lubimaya-status">{status}</p> : null}
            </form>
          </section>
        ) : null}

        {scene === "why" ? (
          <section className={stageClass} aria-live="polite">
            <h2 className="lubimaya-draw lubimaya-draw--sm is-ready">Почему?</h2>
            <p className="lubimaya-line is-in">Что я могу сделать, чтобы ты меня простила?</p>
            <form
              className="lubimaya-form is-in"
              onSubmit={(e) => {
                e.preventDefault();
                onSubmitText({
                  scenario: "Почему? Что я могу сделать чтобы ты меня простила?",
                  answer: whyText,
                  step: "why",
                  next: "received",
                });
              }}
            >
              <textarea
                className="lubimaya-input"
                value={whyText}
                onChange={(e) => setWhyText(e.target.value)}
                placeholder="Твой ответ…"
                maxLength={2000}
                required
              />
              <div className="lubimaya-form-row">
                <button type="submit" className="lubimaya-btn lubimaya-btn--send" disabled={busy}>
                  Отправить
                </button>
              </div>
              {status ? <p className="lubimaya-status">{status}</p> : null}
            </form>
          </section>
        ) : null}

        {scene === "thanks" ? (
          <section className={stageClass} aria-live="polite">
            <div className="lubimaya-heart-scene is-in">
              <Heart3D />
            </div>
            <h2 className="lubimaya-finale">Спасибо Любимая, ты для меня всё!</h2>
          </section>
        ) : null}

        {scene === "received" ? (
          <section className={stageClass} aria-live="polite">
            <div className="lubimaya-heart-scene is-in">
              <Heart3D />
            </div>
            <h2 className="lubimaya-finale">Я получил твой ответ. Спасибо, что написала.</h2>
          </section>
        ) : null}
      </div>
    </main>
  );
}
