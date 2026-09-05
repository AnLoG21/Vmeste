/** Deep links from native shells (Android MainActivity, iOS Universal Links, App plugin). */

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

function handleDeepUrl(url) {
  if (!url) return;
  applyDeepLinkPath(url);
}

export function initNativeDeepLinks() {
  const onDeep = (ev) => {
    const detail = ev?.detail;
    const url =
      typeof detail === "string"
        ? detail
        : detail?.url || detail?.data || (typeof detail === "object" && detail !== null ? detail.href : "");
    handleDeepUrl(url);
  };
  window.addEventListener("vmesteDeepLink", onDeep);
  document.addEventListener("vmesteDeepLink", onDeep);

  let removeAppUrlOpen = null;
  import("@capacitor/app")
    .then(({ App }) => {
      const sub = App.addListener("appUrlOpen", (event) => {
        handleDeepUrl(event?.url);
      });
      removeAppUrlOpen = () => {
        Promise.resolve(sub).then((h) => h?.remove?.()).catch(() => {});
      };
      return App.getLaunchUrl?.();
    })
    .then((launch) => {
      if (launch?.url) handleDeepUrl(launch.url);
    })
    .catch(() => {
      /* web / plugin missing */
    });

  return () => {
    window.removeEventListener("vmesteDeepLink", onDeep);
    document.removeEventListener("vmesteDeepLink", onDeep);
    removeAppUrlOpen?.();
  };
}
