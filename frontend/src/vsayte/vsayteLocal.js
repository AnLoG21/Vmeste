/** IndexedDB storage for free local-only sites. */

const DB_NAME = "vsayte_local_v1";
const STORE = "sites";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function localListSites() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function localGetSite(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function localSaveSite(site) {
  const now = new Date().toISOString();
  const record = {
    ...site,
    id: site.id || `local-${Date.now()}`,
    local: true,
    updated_at: now,
    created_at: site.created_at || now,
    status: "draft",
  };
  await withStore("readwrite", (store) => store.put(record));
  return record;
}

export async function localDeleteSite(id) {
  await withStore("readwrite", (store) => store.delete(id));
}

import { VSAYTE_INTERACTIVE_CSS } from "./vsayteSiteCss.js";

function wrapPageHtml(title, css, html, description = "", site = {}) {
  const safeTitle = String(title || "Сайт").replace(/</g, "");
  const desc = String(description || site.ogDescription || "").replace(/"/g, "&quot;").replace(/</g, "");
  const ogTitle = String(site.ogTitle || title || "").replace(/"/g, "&quot;").replace(/</g, "");
  const ogDesc = String(site.ogDescription || description || "").replace(/"/g, "&quot;").replace(/</g, "");
  const siteName = String(site.name || "").replace(/"/g, "&quot;").replace(/</g, "");
  const favicon = String(site.favicon || "").replace(/"/g, "&quot;");
  const ogImage = String(site.ogImage || "").replace(/"/g, "&quot;");
  const tags = [
    '<meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
  ];
  if (desc) tags.push(`<meta name="description" content="${desc}"/>`);
  if (favicon) tags.push(`<link rel="icon" href="${favicon}"/>`);
  if (siteName) tags.push(`<meta property="og:site_name" content="${siteName}"/>`);
  if (ogTitle) tags.push(`<meta property="og:title" content="${ogTitle}"/>`);
  if (ogDesc) tags.push(`<meta property="og:description" content="${ogDesc}"/>`);
  if (ogImage) {
    tags.push(`<meta property="og:image" content="${ogImage}"/>`);
    tags.push(`<meta name="twitter:card" content="summary_large_image"/>`);
  }
  tags.push(`<title>${safeTitle}</title>`);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
${tags.join("\n")}
<style>${css || ""}\n${VSAYTE_INTERACTIVE_CSS}\n${site.customCss || ""}</style>
</head>
<body>${html || ""}</body>
</html>`;
}

export function exportSiteHtml(document, title = "Сайт") {
  const pages = document?.pages?.length
    ? document.pages
    : [{ name: title, html: document?.html || "", css: document?.css || "" }];
  const page = pages[0];
  const css = `${document?.css || ""}\n${page.css || ""}`;
  const pageTitle = page.seoTitle || page.name || title;
  const site = document?.meta?.site || {};
  if (pages.length <= 1) {
    return wrapPageHtml(pageTitle, css, page.html || document?.html || "", page.seoDescription || "", site);
  }
  const nav = pages
    .map((p) => {
      const href = p.path === "/" ? "index.html" : `${String(p.path || "").replace(/^\//, "") || "page"}.html`;
      return `<a href="${href}" style="margin-right:12px;">${p.name || href}</a>`;
    })
    .join("");
  return wrapPageHtml(
    pageTitle,
    css,
    `<nav style="padding:12px 16px;border-bottom:1px solid #eee;font-family:system-ui,sans-serif;">${nav}</nav>${page.html || document?.html || ""}`,
    page.seoDescription || "",
    site,
  );
}
