import { Capacitor } from "@capacitor/core";

const MIN_MS = 700;
const MAX_MS = 1600;
const FADE_MS = 380;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

async function hideNativeSplash() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide({ fadeOutDuration: FADE_MS });
  } catch {
    /* plugin optional until native sync */
  }
}

/**
 * Branded boot splash: smooth scale/fade, then remove overlay.
 * Native Android/iOS splash matches background so the handoff feels continuous.
 */
export function initBootSplash() {
  const el = document.getElementById("vmeste-boot-splash");
  const native = Capacitor.isNativePlatform();
  // Branded animation is for the installed app; on desktop web skip overlay.
  if (!el || !native) {
    el?.remove();
    hideNativeSplash();
    return;
  }

  const started = performance.now();
  const reduced = prefersReducedMotion();
  if (reduced) el.classList.add("vmeste-boot-splash--reduced");

  let settled = false;
  const finish = async () => {
    if (settled) return;
    settled = true;
    const elapsed = performance.now() - started;
    const wait = Math.max(0, (reduced ? 200 : MIN_MS) - elapsed);
    await new Promise((r) => setTimeout(r, wait));
    await hideNativeSplash();
    el.classList.add("vmeste-boot-splash--out");
    window.setTimeout(() => el.remove(), FADE_MS + 40);
  };

  const onReady = () => {
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
  };

  // Cap total time so a slow network still clears splash.
  window.setTimeout(finish, reduced ? 400 : MAX_MS);
  onReady();
}
