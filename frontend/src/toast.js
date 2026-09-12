/** Lightweight toast notifications (auto-hide, dismissible). */

let host = null;

function ensureHost() {
  if (typeof document === "undefined") return null;
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "vmeste-toast-host";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  return host;
}

/**
 * @param {string} message
 * @param {{ tone?: 'success'|'info'|'error', ms?: number }} [opts]
 */
export function showToast(message, opts = {}) {
  const elHost = ensureHost();
  if (!elHost || !message) return;
  const tone = opts.tone || "success";
  const baseMs = opts.ms ?? 3000;
  const card = document.createElement("div");
  card.className = `vmeste-toast vmeste-toast--${tone}`;
  card.innerHTML = `<span class="vmeste-toast-text"></span><button type="button" class="vmeste-toast-close" aria-label="Закрыть">×</button>`;
  const textEl = card.querySelector(".vmeste-toast-text");
  textEl.textContent = String(message).trim();
  let closed = false;
  let timer = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) window.clearTimeout(timer);
    card.classList.add("vmeste-toast--out");
    window.setTimeout(() => card.remove(), 220);
  };
  card.querySelector(".vmeste-toast-close").addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  elHost.appendChild(card);
  timer = window.setTimeout(close, baseMs);
}

/** Short line for UI toasts — strip raw URLs that blow up mobile layout. */
export function toastFriendlyText(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const noUrl = s.replace(/https?:\/\/\S+/gi, "").replace(/\s{2,}/g, " ").trim();
  const base = noUrl || "Новое уведомление";
  return base.length > 120 ? `${base.slice(0, 117)}…` : base;
}
