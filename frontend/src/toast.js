/** Lightweight toast notifications (auto-hide, dismissible). */

let host = null;
let lastPointerAt = Date.now();

function ensureHost() {
  if (typeof document === "undefined") return null;
  if (host && document.body.contains(host)) return host;
  host = document.createElement("div");
  host.className = "vmeste-toast-host";
  host.setAttribute("aria-live", "polite");
  document.body.appendChild(host);
  if (!window.__vmesteToastPointerBound) {
    window.__vmesteToastPointerBound = true;
    const mark = () => {
      lastPointerAt = Date.now();
    };
    document.addEventListener("pointerdown", mark, { passive: true });
    document.addEventListener("pointermove", mark, { passive: true });
    document.addEventListener("keydown", mark, { passive: true });
  }
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
  // Default ~12s so longer messages (e.g. password email hint) are readable
  const baseMs = opts.ms ?? 12000;
  const idleGraceMs = 5000;
  const card = document.createElement("div");
  card.className = `vmeste-toast vmeste-toast--${tone}`;
  card.innerHTML = `<span class="vmeste-toast-text"></span><button type="button" class="vmeste-toast-close" aria-label="Закрыть">×</button>`;
  card.querySelector(".vmeste-toast-text").textContent = message;
  let closed = false;
  let timer = null;
  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) window.clearTimeout(timer);
    card.classList.add("vmeste-toast--out");
    window.setTimeout(() => card.remove(), 220);
  };
  card.querySelector(".vmeste-toast-close").addEventListener("click", close);
  elHost.appendChild(card);

  const shownAt = Date.now();
  const tick = () => {
    if (closed) return;
    const now = Date.now();
    const minElapsed = now - shownAt >= baseMs;
    const idleFor = now - lastPointerAt;
    // Stay at least baseMs; if user is still interacting, wait until idleGraceMs after last activity
    if (!minElapsed) {
      timer = window.setTimeout(tick, Math.min(1000, baseMs - (now - shownAt)));
      return;
    }
    if (idleFor < idleGraceMs) {
      timer = window.setTimeout(tick, idleGraceMs - idleFor + 50);
      return;
    }
    close();
  };
  timer = window.setTimeout(tick, baseMs);
}
