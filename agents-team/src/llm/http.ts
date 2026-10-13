import { HttpsProxyAgent } from "https-proxy-agent";
import nodeFetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { config } from "../config.js";

function proxyAgent(proxyUrl: string) {
  if (/^socks/i.test(proxyUrl)) return new SocksProxyAgent(proxyUrl);
  return new HttpsProxyAgent(proxyUrl);
}

/** fetch for LLM APIs — via TELEGRAM_HTTP_PROXY / LLM_HTTP_PROXY when VPS IPs are blocked (Groq 403). */
export async function llmFetch(url: string, init: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ ok: boolean; status: number; text: () => Promise<string>; json: () => Promise<unknown> }> {
  const proxy = (config.llmHttpProxy || config.telegramHttpProxy || "").trim();
  if (!proxy) {
    const res = await fetch(url, init);
    return {
      ok: res.ok,
      status: res.status,
      text: () => res.text(),
      json: () => res.json(),
    };
  }

  const agent = proxyAgent(proxy);
  const res = await nodeFetch(url, { ...init, agent });
  return {
    ok: res.ok,
    status: res.status,
    text: () => res.text(),
    json: () => res.json(),
  };
}

export function llmProxyInfo(): string {
  const proxy = (config.llmHttpProxy || config.telegramHttpProxy || "").trim();
  return proxy ? `proxy ${proxy}` : "direct";
}
