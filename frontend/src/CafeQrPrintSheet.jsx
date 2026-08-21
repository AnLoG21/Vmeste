import { useMemo } from "react";
import { createPortal } from "react-dom";
import { QrImg } from "./qrUtils.jsx";

/**
 * Печать карточек QR: меню заведения и/или столы зала.
 * Открывается оверлеем → window.print() → только .cafe-qr-print-* в печати.
 */
export default function CafeQrPrintSheet({
  open,
  onClose,
  orgName = "Вместе",
  floorName = "",
  menuUrl = "",
  tables = [],
  publicOrigin = "https://vsevmeste.space",
}) {
  const cards = useMemo(() => {
    const list = [];
    if (menuUrl) {
      list.push({
        key: "menu",
        title: "Меню",
        subtitle: "Самовывоз и доставка",
        url: menuUrl,
        pin: "",
        kind: "menu",
      });
    }
    for (const t of tables || []) {
      if (!t?.public_token) continue;
      list.push({
        key: `t-${t.id}`,
        title: t.label || `Стол ${t.id}`,
        subtitle: floorName ? `Зал: ${floorName}` : "Стол",
        url: `${publicOrigin}/t/${t.public_token}`,
        pin: t.pin_code || "",
        kind: "table",
      });
    }
    return list;
  }, [menuUrl, tables, floorName, publicOrigin]);

  if (!open) return null;

  function doPrint() {
    window.setTimeout(() => window.print(), 80);
  }

  return createPortal(
    <div className="cafe-qr-print-overlay" role="dialog" aria-modal="true" aria-label="Печать QR">
      <div className="cafe-qr-print-toolbar no-print">
        <div>
          <strong>Печать QR</strong>
          <p className="muted small">
            {cards.length
              ? `${cards.length} карточек · на лист A4 помещается несколько`
              : "Нет столов с токеном — сначала сохраните столы"}
          </p>
        </div>
        <div className="cafe-toolbar">
          <button type="button" className="landing-btn landing-btn--primary" onClick={doPrint} disabled={!cards.length}>
            Печать
          </button>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>

      <div className="cafe-qr-print-sheet">
        <header className="cafe-qr-print-header">
          <h1>{orgName}</h1>
          {floorName ? <p>{floorName}</p> : null}
        </header>
        <div className="cafe-qr-print-grid">
          {cards.map((c) => (
            <article key={c.key} className={`cafe-qr-print-card cafe-qr-print-card--${c.kind}`}>
              <h2>{c.title}</h2>
              <p className="cafe-qr-print-sub">{c.subtitle}</p>
              <QrImg data={c.url} size={200} alt={`QR ${c.title}`} />
              {c.pin ? <p className="cafe-qr-print-pin">PIN: {c.pin}</p> : null}
              <p className="cafe-qr-print-url">{c.url}</p>
              <p className="cafe-qr-print-hint">
                {c.kind === "menu" ? "Отсканируйте → меню" : "Отсканируйте → меню стола"}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
