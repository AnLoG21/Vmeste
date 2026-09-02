/** Inline error with optional retry — for lists and tabs that failed to load. */
export function LoadErrorBanner({ message = "Не удалось загрузить данные.", onRetry }) {
  return (
    <div className="load-error-banner" role="alert">
      <p className="load-error-banner-text">{message}</p>
      {onRetry ? (
        <button type="button" className="ghost-btn load-error-banner-retry" onClick={onRetry}>
          Повторить
        </button>
      ) : null}
    </div>
  );
}
