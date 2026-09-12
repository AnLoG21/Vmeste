/** Checklist «первые шаги» after platform tour (P3). */

export default function SetupChecklist({
  steps = [],
  onOpen,
  onDismiss,
  onQuickStart,
  quickStartBusy = false,
  showQuickStart = false,
}) {
  const pending = (steps || []).filter((s) => !s.done);
  if (!pending.length) return null;

  const doneCount = (steps || []).filter((s) => s.done).length;
  const total = (steps || []).length || 3;

  return (
    <section className="setup-checklist" aria-label="Первые шаги">
      <div className="setup-checklist-head">
        <div>
          <strong>Первые шаги</strong>
          <span className="muted small">
            {" "}
            · {doneCount}/{total}
          </span>
        </div>
        {onDismiss ? (
          <button type="button" className="ghost-btn small" onClick={onDismiss} aria-label="Скрыть">
            Скрыть
          </button>
        ) : null}
      </div>
      {showQuickStart && onQuickStart ? (
        <div className="setup-checklist-quick">
          <p className="muted small">
            Одним действием: шаблон услуг, 5 активных позиций и слоты на будни 10:00–19:00.
          </p>
          <button type="button" disabled={quickStartBusy} onClick={onQuickStart}>
            {quickStartBusy ? "Настраиваем…" : "Быстрый старт (~1 мин)"}
          </button>
        </div>
      ) : null}
      <ol className="setup-checklist-list">
        {(steps || []).map((step) => (
          <li key={step.id} className={step.done ? "is-done" : ""}>
            <span className="setup-checklist-mark" aria-hidden="true">
              {step.done ? "✓" : "○"}
            </span>
            <span className="setup-checklist-label">{step.label}</span>
            {!step.done && step.view ? (
              <button type="button" className="ghost-btn small" onClick={() => onOpen?.(step.view)}>
                Открыть
              </button>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
