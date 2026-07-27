/** Client-side document head updates for SPA marketing routes. */

const META_KEYS = [
  "description",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:type",
  "og:locale",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "robots",
];

function upsertMeta(attr, key, content) {
  if (typeof document === "undefined" || content == null || content === "") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (typeof document === "undefined" || !href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

/**
 * @param {{
 *   title?: string,
 *   description?: string,
 *   path?: string,
 *   image?: string,
 *   robots?: string,
 * }} opts
 */
export function setPageMeta({
  title,
  description,
  path = "/",
  image = "https://vsevmeste.space/og-cover.png",
  robots = "index,follow",
} = {}) {
  if (typeof document === "undefined") return;
  if (title) document.title = title;
  const url = path.startsWith("http") ? path : `https://vsevmeste.space${path === "/" ? "/" : path}`;
  if (description) upsertMeta("name", "description", description);
  upsertMeta("name", "robots", robots);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:locale", "ru_RU");
  upsertMeta("property", "og:url", url);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:image:width", "1200");
  upsertMeta("property", "og:image:height", "630");
  if (title) upsertMeta("property", "og:title", title);
  if (description) upsertMeta("property", "og:description", description);
  upsertMeta("name", "twitter:card", "summary_large_image");
  if (title) upsertMeta("name", "twitter:title", title);
  if (description) upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);
  upsertLink("canonical", url);
}

export function setNoIndexAppMeta() {
  setPageMeta({
    title: "Вместе — личный кабинет",
    description: "Личный кабинет сервиса Вместе.",
    path: typeof window !== "undefined" ? window.location.pathname : "/cabinet",
    robots: "noindex,nofollow",
  });
}

export { META_KEYS };
