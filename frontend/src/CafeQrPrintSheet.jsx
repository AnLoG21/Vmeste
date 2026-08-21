import { useMemo } from "react";
import { createPortal } from "react-dom";
import { QrImg } from "./qrUtils.jsx";

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
      <path d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zm3-7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM17 3H7v4h10V3z" />
    </svg>
  );
}

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
        <div className="cafe-qr-print-toolbar-copy">
          <strong>Печать QR</strong>
          <p className="muted small">
            {cards.length
              ? `${cards.length} карточек · на лист A4 помещается несколько`
              : "Нет столов с токеном — сначала сохраните столы"}
          </p>
        </div>
        <div className="cafe-qr-print-actions">
          <button
            type="button"
            className="landing-btn landing-btn--primary cafe-qr-print-btn"
            onClick={doPrint}
            disabled={!cards.length}
          >
            <PrintIcon />
            <span>Печать</span>
          </button>
          <button type="button" className="ghost-btn cafe-qr-print-close" onClick={onClose}>
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
