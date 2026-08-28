import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CARD_EDITOR_TOUR_STEPS } from "./cardSlideEditorTour.js";
import "./cardSlideEditorTour.css";

function useTargetRect(selector, active) {
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (!active || !selector) {
      setRect(null);
      return undefined;
    }
    const update = () => {
      const el = document.querySelector(selector);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    update();
    const timer = setInterval(update, 200);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [selector, active]);

  return rect;
}

/**
 * @param {'welcome' | 'running' | 'hidden'} phase
 */
export default function CardSlideEditorTour({ phase, step = 0, onStart, onSkip, onNext, onBack, onFinish }) {
  const running = phase === "running";
  const current = CARD_EDITOR_TOUR_STEPS[step];
  const rect = useTargetRect(current?.target, running);
  const isLast = step >= CARD_EDITOR_TOUR_STEPS.length - 1;

  if (phase === "hidden") return null;

  const tooltipStyle = rect
    ? {
        top: Math.min(rect.bottom + 12, window.innerHeight - 220),
        left: Math.min(Math.max(12, rect.left), window.innerWidth - 340),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return createPortal(
    <div className="cst-root" role="dialog" aria-modal="true" aria-label="Обучение редактору слайдов">
      <div className="cst-backdrop" onClick={phase === "welcome" ? undefined : onSkip} />

      {running && rect ? (
        <div
          className="cst-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}

      {phase === "welcome" ? (
        <div className="cst-welcome">
          <h3>Редактор слайдов</h3>
          <p>
            Короткая обучалка покажет инструменты, поля товара и как сохранить шаблон. Займёт около минуты.
          </p>
          <div className="cst-actions">
            <button type="button" className="mp-btn mp-btn-primary" onClick={onStart}>
              Начать обучение
            </button>
            <button type="button" className="ghost-btn" onClick={onSkip}>
              Пропустить
            </button>
          </div>
        </div>
      ) : (
        <div className="cst-tooltip" style={tooltipStyle}>
          <p className="cst-step-count">
            Шаг {step + 1} из {CARD_EDITOR_TOUR_STEPS.length}
          </p>
          <strong>{current?.title}</strong>
          <p>{current?.text}</p>
          {!rect ? <p className="cst-missing muted small">Прокрутите страницу, если элемент не виден.</p> : null}
          <div className="cst-actions">
            <button type="button" className="ghost-btn" onClick={onSkip}>
              Пропустить
            </button>
            {step > 0 ? (
              <button type="button" className="ghost-btn" onClick={onBack}>
                Назад
              </button>
            ) : null}
            <button type="button" className="mp-btn mp-btn-primary" onClick={isLast ? onFinish : onNext}>
              {isLast ? "Готово" : "Далее"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
