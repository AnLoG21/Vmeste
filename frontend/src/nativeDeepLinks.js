/** Deep links from Android MainActivity (vmesteDeepLink) and path routing. */

/**
 * Normalize https://vsevmeste.space/... or vmeste://app/... into an in-app path+search+hash.
 */
export function pathFromDeepLinkUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    if (s.startsWith("vmeste://")) {
      const rest = s.replace(/^vmeste:\/\/app\/?/i, "/").replace(/^vmeste:\/\//i, "/");
      const u = new URL(rest, "https://vsevmeste.space");
      return `${u.pathname}${u.search}${u.hash}` || "/";
    }
    const u = new URL(s);
    if (!/vsevmeste\.space$/i.test(u.hostname) && u.hostname !== "localhost") {
      return "";
    }
    return `${u.pathname}${u.search}${u.hash}` || "/";
  } catch {
    if (s.startsWith("/")) return s;
    return "";
  }
}

export function applyDeepLinkPath(pathWithQuery) {
  const path = pathFromDeepLinkUrl(pathWithQuery) || pathWithQuery;
  if (!path || path === "/" || path === window.location.pathname + window.location.search + window.location.hash) {
    return false;
  }
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  // PublicEntry / cafe guest routes that mount before App need a hard navigation.
  if (/^\/(t|m|o|w|inspect)\b/i.test(path.split("?")[0])) {
    window.location.assign(path);
    return true;
  }
  return true;
}

export function initNativeDeepLinks() {
  const onDeep = (ev) => {
    const detail = ev?.detail;
    const url =
      typeof detail === "string"
        ? detail
        : detail?.url || detail?.data || (typeof detail === "object" && detail !== null ? detail.href : "");
    if (!url) return;
    applyDeepLinkPath(url);
  };
  window.addEventListener("vmesteDeepLink", onDeep);
  document.addEventListener("vmesteDeepLink", onDeep);
  return () => {
    window.removeEventListener("vmesteDeepLink", onDeep);
    document.removeEventListener("vmesteDeepLink", onDeep);
  };
}
