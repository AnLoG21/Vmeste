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

export function exportSiteHtml(document, title = "Сайт") {
  const pages = document?.pages?.length
    ? document.pages
    : [{ name: title, html: document?.html || "", css: document?.css || "" }];
  const page = pages[0];
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${String(title).replace(/</g, "")}</title>
<style>${document?.css || ""}\n${page.css || ""}</style>
</head>
<body>${page.html || document?.html || ""}</body>
</html>`;
}
