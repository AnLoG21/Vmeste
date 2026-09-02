/** Подписка на ICS-календарь записей организации. */
export default function OrgCalendarSection({ links, status, onRotateToken, onCopyStatus }) {
  return (
    <>
      <h3>Календарь записей</h3>
      <p className="muted small">
        Подпишите календарь записей по ссылке — события появятся в Google Календаре, Яндекс Календаре или Apple
        Календаре и будут обновляться автоматически.
      </p>
      {links ? (
        <div className="form org-calendar-block">
          <label className="field-label" htmlFor="org-ics-url">
            Ссылка календаря (ICS)
          </label>
          <div className="org-calendar-copy-row">
            <input
              id="org-ics-url"
              type="text"
              readOnly
              value={links.ics_url || ""}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={async () => {
                const url = links.ics_url || "";
                try {
                  await navigator.clipboard.writeText(url);
                  onCopyStatus("Ссылка скопирована");
                } catch {
                  onCopyStatus("Не удалось скопировать — выделите поле вручную");
                }
              }}
            >
              Скопировать
            </button>
          </div>
          <div className="org-calendar-actions">
            <a className="landing-btn landing-btn--outline" href={links.google_url || "#"} target="_blank" rel="noreferrer">
              Google Календарь
            </a>
            <a className="landing-btn landing-btn--outline" href={links.webcal_url || "#"}>
              Яндекс / Apple
            </a>
          </div>
          {links.yandex_hint ? <p className="muted small">{links.yandex_hint}</p> : null}
          <button type="button" className="ghost-btn" onClick={onRotateToken}>
            Сменить ссылку
          </button>
          <p className="status">{status}</p>
        </div>
      ) : (
        <p className="muted small">Загрузка ссылки…</p>
      )}
    </>
  );
}
