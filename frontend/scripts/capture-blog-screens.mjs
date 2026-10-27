/**
 * Capture desktop blog screenshots via real Chrome CDP (avoids Cursor browser tiling).
 * Usage: node capture-blog-screens.mjs
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/blog/img/screens");
const BASE = "https://vsevmeste.space";
const API = `${BASE}/api`;
const CHROME =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9229;
const W = 1400;
const H = 900;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.eventWaiters = new Map();
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method && this.eventWaiters.has(msg.method)) {
        const waiters = this.eventWaiters.get(msg.method);
        this.eventWaiters.delete(msg.method);
        for (const resolve of waiters) resolve(msg.params);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  once(event) {
    return new Promise((resolve) => {
      const list = this.eventWaiters.get(event) || [];
      list.push(resolve);
      this.eventWaiters.set(event, list);
    });
  }
}

async function connectTab() {
  const list = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === "page") || list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  return new Cdp(ws);
}

async function demoLogin(sphere) {
  const res = await fetch(`${API}/users/demo-login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sphere }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "demo-login failed");
  return data;
}

async function setAuth(cdp, tokens) {
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      localStorage.setItem("vmeste_access", ${JSON.stringify(tokens.access)});
      localStorage.setItem("vmeste_refresh", ${JSON.stringify(tokens.refresh)});
      localStorage.setItem("vmeste_demo", "1");
      localStorage.setItem("vmeste_cookie_consent_v1", "all");
      return true;
    })()`,
    returnByValue: true,
  });
}

async function goto(cdp, url) {
  await cdp.send("Page.enable");
  const loaded = cdp.once("Page.loadEventFired");
  await cdp.send("Page.navigate", { url });
  await Promise.race([loaded, sleep(15000)]);
  // Wait for SPA paint
  for (let i = 0; i < 50; i++) {
    const { result } = await cdp.send("Runtime.evaluate", {
      expression: `document.body && document.body.innerText.length > 80`,
      returnByValue: true,
    });
    if (result?.value) break;
    await sleep(300);
  }
  await sleep(1500);
}

async function shot(cdp, name) {
  await cdp.send("Runtime.evaluate", {
    expression: `(() => {
      document.querySelectorAll('button,a,[role="button"]').forEach(el => {
        const t = (el.textContent || '').trim();
        if (/^(Принять|Согласен|OK|Хорошо|Понятно)$/i.test(t)) el.click();
      });
      document.querySelectorAll('[class*="cookie"],[id*="cookie"]').forEach(el => {
        if (/cookie|куки|согласи/i.test(el.textContent || '')) el.style.display = 'none';
      });
      window.scrollTo(0, 0);
      return true;
    })()`,
  });
  await sleep(400);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const out = path.join(OUT_DIR, name);
  await writeFile(out, Buffer.from(data, "base64"));
  console.log("wrote", name, Buffer.from(data, "base64").length, "bytes");
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const userData = path.resolve(__dirname, ".chrome-blog-screens");
  const chrome = spawn(
    CHROME,
    [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${userData}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--window-size=${W},${H}`,
      "--force-device-scale-factor=1",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  try {
    for (let i = 0; i < 30; i++) {
      try {
        await fetchJson(`http://127.0.0.1:${PORT}/json/version`);
        break;
      } catch {
        await sleep(200);
      }
    }
    const cdp = await connectTab();
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: W,
      height: H,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // --- Salon sphere ---
    const salon = await demoLogin("hair_salon");
    await goto(cdp, BASE + "/");
    await setAuth(cdp, salon);
    await goto(cdp, BASE + "/staff");
    await sleep(1500);
    await shot(cdp, "staff-wide.png");

    await goto(cdp, BASE + "/bookings");
    await sleep(1500);
    await shot(cdp, "calendar-bookings-wide.png");

    await goto(cdp, BASE + "/service-catalog");
    await sleep(1500);
    await shot(cdp, "services-catalog-wide.png");

    await goto(cdp, BASE + "/intervals");
    await sleep(1500);
    await shot(cdp, "intervals-wide.png");

    await goto(cdp, BASE + "/chats");
    await sleep(1500);
    await shot(cdp, "chats-wide.png");

    await goto(cdp, BASE + "/organization#org-booking-messages");
    await sleep(1500);
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const el = document.getElementById("org-booking-messages");
        if (el) el.scrollIntoView({ block: "start" });
        return !!el;
      })()`,
    });
    await sleep(600);
    await shot(cdp, "org-messages-wide.png");

    await goto(cdp, BASE + "/organization");
    await sleep(1000);
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const el = [...document.querySelectorAll("h3")].find((e) => /Виджет записи/.test(e.textContent || ""));
        if (el) el.scrollIntoView({ block: "center" });
        return !!el;
      })()`,
    });
    await sleep(600);
    await shot(cdp, "widget-settings-wide.png");

    await goto(cdp, BASE + "/w/demo-salon");
    await sleep(2000);
    await shot(cdp, "widget-public-wide.png");

    // --- Cafe sphere ---
    const cafe = await demoLogin("cafe_restaurant");
    await goto(cdp, BASE + "/");
    await setAuth(cdp, cafe);
    await goto(cdp, BASE + "/cafe");
    await sleep(2000);
    await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const el = [...document.querySelectorAll("h3")].find((e) => /QR меню/.test(e.textContent || ""));
        if (el) el.scrollIntoView({ block: "center" });
        return !!el;
      })()`,
    });
    await sleep(600);
    await shot(cdp, "cafe-qr-wide.png");

    await goto(cdp, BASE + "/m/demo-cafe");
    await sleep(2000);
    await shot(cdp, "cafe-menu-public-wide.png");

    await goto(cdp, BASE + "/cabinet");
    await sleep(1500);
    await shot(cdp, "cabinet-menu-wide.png");

    cdp.ws.close();
  } finally {
    try {
      chrome.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
