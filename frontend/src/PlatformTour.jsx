import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./platformTour.css";

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
export default function PlatformTour({
  phase,
  steps = [],
  step = 0,
  onStart,
  onSkip,
  onNext,
  onBack,
  onFinish,
  onPrepareStep,
}) {
  const running = phase === "running";
  const current = steps[step];
  const rect = useTargetRect(current?.target, running);
  const isLast = step >= steps.length - 1;

  useEffect(() => {
    if (!running || !current?.prepare || !onPrepareStep) return;
    onPrepareStep(current);
  }, [running, step, current?.id, current?.prepare, onPrepareStep]);

  if (phase === "hidden") return null;

  const tooltipStyle = rect
    ? {
        top: Math.min(rect.bottom + 12, window.innerHeight - 240),
        left: Math.min(Math.max(12, rect.left), window.innerWidth - 380),
      }
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return createPortal(
    <div className="pt-root" role="dialog" aria-modal="true" aria-label="Обучение платформе">
      <div className="pt-backdrop" />

      {running && rect ? (
        <div
          className="pt-spotlight"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      ) : null}

      {phase === "welcome" ? (
        <div className="pt-welcome">
          <h3>Обучение платформе</h3>
          <p>
            Короткий тур по кабинету организации: разделы меню, основные экраны и где настроить профиль
            компании. Займёт около минуты.
          </p>
          <div className="pt-actions">
            <button type="button" className="primary-btn" onClick={onStart}>
              Начать обучение
            </button>
            <button type="button" className="ghost-btn" onClick={onSkip}>
              Пропустить
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-tooltip" style={tooltipStyle}>
          <p className="pt-step-count">
            Шаг {step + 1} из {steps.length}
          </p>
          <strong>{current?.title}</strong>
          <p>{current?.text}</p>
          {!rect ? <p className="pt-missing muted small">Элемент не на экране — нажмите «Далее».</p> : null}
          <div className="pt-actions">
            <button type="button" className="ghost-btn" onClick={onSkip}>
              Пропустить
            </button>
            {step > 0 ? (
              <button type="button" className="ghost-btn" onClick={onBack}>
                Назад
              </button>
            ) : null}
            <button type="button" className="primary-btn" onClick={isLast ? onFinish : onNext}>
              {isLast ? "Готово" : "Далее"}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
