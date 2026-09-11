/** Platform confirm dialog (Promise) — replaces window.confirm. */

let host = null;
let styleReady = false;

function ensureStyles() {
  if (styleReady || typeof document === "undefined") return;
  styleReady = true;
  if (document.getElementById("vmeste-confirm-styles")) return;
  const style = document.createElement("style");
  style.id = "vmeste-confirm-styles";
  style.textContent = `
.vmeste-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(17, 17, 17, 0.48);
  animation: vmeste-confirm-fade-in 0.16s ease-out;
}
.vmeste-confirm-card {
  width: min(400px, 92vw);
  background: #fff;
  border: 1px solid #ffd9bd;
  border-radius: 14px;
  padding: 20px 18px 16px;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.22);
  animation: vmeste-confirm-pop 0.18s ease-out;
}
.vmeste-confirm-title {
  margin: 0 0 8px;
  font-size: 1.15rem;
  line-height: 1.3;
  color: #1a1a1a;
}
.vmeste-confirm-message {
  margin: 0 0 18px;
  font-size: 0.95rem;
  line-height: 1.45;
  color: #5c6b78;
  white-space: pre-wrap;
}
.vmeste-confirm-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.vmeste-confirm-cancel {
  border: 1px solid #ffd9bd;
  background: #fff;
  color: #5c4030;
  border-radius: 10px;
  padding: 9px 14px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.vmeste-confirm-cancel:hover {
  background: #fff8f0;
}
.vmeste-confirm-ok {
  border: none;
  border-radius: 10px;
  padding: 9px 14px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  background: #ff7a00;
}
.vmeste-confirm-ok:hover {
  background: #e86c00;
}
.vmeste-confirm-ok.is-danger {
  background: #c62828;
}
.vmeste-confirm-ok.is-danger:hover {
  background: #b71c1c;
}
@keyframes vmeste-confirm-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes vmeste-confirm-pop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
`;
  document.head.appendChild(style);
}

function ensureHost() {
  if (typeof document === "undefined") return null;
  ensureStyles();
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "vmeste-confirm-host";
  document.body.appendChild(host);
  return host;
}

/**
 * @param {string | {
 *   title?: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} messageOrOpts
 * @param {{
 *   title?: string,
 *   confirmLabel?: string,
 *   cancelLabel?: string,
 *   danger?: boolean,
 * }} [maybeOpts]
 * @returns {Promise<boolean>}
 */
export function confirmDialog(messageOrOpts, maybeOpts = {}) {
  const opts =
    typeof messageOrOpts === "string"
      ? { message: messageOrOpts, ...maybeOpts }
      : { ...(messageOrOpts || {}), ...maybeOpts };

  const title = (opts.title || "").trim();
  const message = (opts.message || opts.text || "").trim() || "Продолжить?";
  const danger = opts.danger !== false && opts.tone !== "primary";
  const confirmLabel = (opts.confirmLabel || (danger ? "Удалить" : "Продолжить")).trim();
  const cancelLabel = (opts.cancelLabel || "Отменить").trim();

  const elHost = ensureHost();
  if (!elHost) return Promise.resolve(false);

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "vmeste-confirm-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    if (title) backdrop.setAttribute("aria-labelledby", "vmeste-confirm-title");

    const card = document.createElement("div");
    card.className = "vmeste-confirm-card";

    if (title) {
      const h = document.createElement("h3");
      h.id = "vmeste-confirm-title";
      h.className = "vmeste-confirm-title";
      h.textContent = title;
      card.appendChild(h);
    }

    const p = document.createElement("p");
    p.className = "vmeste-confirm-message";
    p.textContent = message;
    card.appendChild(p);

    const actions = document.createElement("div");
    actions.className = "vmeste-confirm-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "vmeste-confirm-cancel";
    cancelBtn.textContent = cancelLabel;

    const okBtn = document.createElement("button");
    okBtn.type = "button";
    okBtn.className = `vmeste-confirm-ok${danger ? " is-danger" : ""}`;
    okBtn.textContent = confirmLabel;

    actions.appendChild(cancelBtn);
    actions.appendChild(okBtn);
    card.appendChild(actions);
    backdrop.appendChild(card);
    elHost.appendChild(backdrop);

    let closed = false;
    const finish = (value) => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      backdrop.remove();
      resolve(Boolean(value));
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finish(true);
      }
    };

    cancelBtn.addEventListener("click", () => finish(false));
    okBtn.addEventListener("click", () => finish(true));
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) finish(false);
    });
    card.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => okBtn.focus(), 0);
  });
}

export default confirmDialog;
