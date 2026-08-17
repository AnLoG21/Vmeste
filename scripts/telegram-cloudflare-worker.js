// Cloudflare Worker: proxy to api.telegram.org for RU VPS that block Telegram.
// Deploy: Workers → Create → paste → route e.g. vmeste-tg.your-subdomain.workers.dev
// In .env on VPS: TELEGRAM_API_BASE=https://vmeste-tg.your-subdomain.workers.dev
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(`https://api.telegram.org${url.pathname}${url.search}`);
    const headers = new Headers(request.headers);
    headers.delete("host");
    return fetch(
      new Request(target.toString(), {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      }),
    );
  },
};
