/** Lightweight toast notifications (auto-hide). */

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
  const baseMs = opts.ms ?? 5000;
  const card = document.createElement("div");
  card.className = `vmeste-toast vmeste-toast--${tone}`;
  card.innerHTML = `<span class="vmeste-toast-text"></span><button type="button" class="vmeste-toast-close" aria-label="Закрыть">×</button>`;
  card.querySelector(".vmeste-toast-text").textContent = message;
  const close = () => {
    card.classList.add("vmeste-toast--out");
    window.setTimeout(() => card.remove(), 220);
  };
  card.querySelector(".vmeste-toast-close").addEventListener("click", close);
  elHost.appendChild(card);

  const schedule = () => {
    const idle = Date.now() - lastPointerAt;
    // If user is active, wait until 5s of idle after show; else hide after baseMs from now
    const wait = Math.max(400, baseMs - Math.min(idle, baseMs));
    window.setTimeout(() => {
      if (Date.now() - lastPointerAt < 400) {
        // still active — extend
        window.setTimeout(close, baseMs);
      } else {
        close();
      }
    }, wait);
  };
  schedule();
}
