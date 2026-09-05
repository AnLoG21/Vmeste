import { Capacitor } from "@capacitor/core";

const MIN_MS = 1100;
const MAX_MS = 1800;
const FADE_MS = 400;

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Native Capacitor shell or installed PWA / «На экран Домой». */
export function shouldShowBootSplash() {
  try {
    if (Capacitor.isNativePlatform()) return true;
  } catch {
    /* ignore */
  }
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
  } catch {
    /* ignore */
  }
  // iOS Safari «Add to Home Screen»
  if (typeof navigator !== "undefined" && navigator.standalone === true) return true;
  return false;
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
 * Branded boot splash with pin-fly animation.
 * Shown in Capacitor apps and installed browser PWAs (not regular desktop tabs).
 */
export function initBootSplash() {
  const el = document.getElementById("vmeste-boot-splash");
  if (!el || !shouldShowBootSplash()) {
    el?.remove();
    hideNativeSplash();
    return;
  }

  document.documentElement.classList.add("vmeste-boot-splash-active");

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
    document.documentElement.classList.remove("vmeste-boot-splash-active");
    window.setTimeout(() => el.remove(), FADE_MS + 40);
  };

  const onReady = () => {
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
  };

  window.setTimeout(finish, reduced ? 400 : MAX_MS);
  onReady();
}
