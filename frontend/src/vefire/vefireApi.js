export async function castToTv(authFetch, API_URL, { url, title = "" }) {
  const res = await authFetch(`${API_URL}/vefire/cast/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, title }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.detail || data?.url?.[0] || `HTTP ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : "Не удалось отправить на ТВ");
  }
  return data;
}

export async function fetchLatestCast(authFetch, API_URL) {
  const res = await authFetch(`${API_URL}/vefire/cast/latest/`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data?.job || null;
}

export async function fetchAgentStatus(authFetch, API_URL) {
  const res = await authFetch(`${API_URL}/vefire/agent/heartbeat/`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return data?.agent || null;
}
