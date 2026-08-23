import { useCallback, useEffect, useState } from "react";

const ATS_OPTIONS = [
  ["generic", "Universal JSON"],
  ["mango", "Mango Office"],
  ["novofon", "Novofon / UIS"],
];

/**
 * Кабинет салона: голосовой администратор — настройки, webhook, тест диалога, журнал звонков.
 */
export default function VoiceAdminPanel({ authFetch, API_URL, apiOrigin = "" }) {
  const [form, setForm] = useState({
    enabled: false,
    inbound_phone: "",
    transfer_phone: "",
    greeting_text: "",
    ats_provider: "generic",
    confirm_outbound_enabled: false,
    tts_enabled: false,
    mango_api_key: "",
    mango_api_salt: "",
    mango_line_number: "",
    mango_extension: "",
    has_mango: false,
    speechkit_ready: false,
    webhook_token: "",
  });
  const [status, setStatus] = useState("");
  const [sessions, setSessions] = useState([]);
  const [simSessionId, setSimSessionId] = useState(null);
  const [simLog, setSimLog] = useState([]);
  const [simInput, setSimInput] = useState("");
  const [simBusy, setSimBusy] = useState(false);
  const [pendingOutbound, setPendingOutbound] = useState([]);

  const webhookUrl = `${(apiOrigin || API_URL.replace(/\/api\/?$/, "")).replace(/\/$/, "")}/api/voice/webhook/inbound/`;

  const load = useCallback(async () => {
    const [sRes, sessRes, outRes] = await Promise.all([
      authFetch(`${API_URL}/voice/settings/`),
      authFetch(`${API_URL}/voice/sessions/`),
      authFetch(`${API_URL}/voice/outbound/pending/`),
    ]);
    if (sRes.ok) {
      const data = await sRes.json();
      setForm((p) => ({ ...p, ...data }));
    }
    if (sessRes.ok) {
      const data = await sessRes.json();
      setSessions(Array.isArray(data) ? data : []);
    }
    if (outRes.ok) {
      const data = await outRes.json();
      setPendingOutbound(Array.isArray(data?.bookings) ? data.bookings : []);
    }
  }, [authFetch, API_URL]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSettings(e) {
    e.preventDefault();
    setStatus("Сохраняем…");
    const res = await authFetch(`${API_URL}/voice/settings/`, {
      method: "PATCH",
      body: JSON.stringify({
        enabled: Boolean(form.enabled),
        inbound_phone: form.inbound_phone || "",
        transfer_phone: form.transfer_phone || "",
        greeting_text: form.greeting_text || "",
        ats_provider: form.ats_provider || "generic",
        confirm_outbound_enabled: Boolean(form.confirm_outbound_enabled),
        tts_enabled: Boolean(form.tts_enabled),
        mango_line_number: form.mango_line_number || "",
        mango_extension: form.mango_extension || "",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.detail || "Не удалось сохранить.");
      return;
    }
    const mangoPatch = {};
    if ((form.mango_api_key || "").trim()) mangoPatch.mango_api_key = form.mango_api_key.trim();
    if ((form.mango_api_salt || "").trim()) mangoPatch.mango_api_salt = form.mango_api_salt.trim();
    if (Object.keys(mangoPatch).length) {
      const res2 = await authFetch(`${API_URL}/voice/settings/`, {
        method: "PATCH",
        body: JSON.stringify(mangoPatch),
      });
      if (res2.ok) {
        const d2 = await res2.json();
        setForm((p) => ({ ...p, ...d2, mango_api_key: "", mango_api_salt: "" }));
      }
    } else {
      setForm((p) => ({ ...p, ...data, mango_api_key: "", mango_api_salt: "" }));
    }
    setStatus("Сохранено.");
    load();
  }

  async function runOutbound(bookingId = null) {
    setStatus("Запускаем обзвон…");
    const body = bookingId ? { booking_id: bookingId } : { limit: 10 };
    const res = await authFetch(`${API_URL}/voice/outbound/run/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || data.detail || "Не удалось запустить обзвон.");
      return;
    }
    setStatus(
      bookingId
        ? `Звонок поставлен в очередь (запись #${bookingId}).`
        : `Обзвон: ${data.dialed || 0} звонков.${data.errors?.length ? ` Ошибок: ${data.errors.length}.` : ""}`,
    );
    load();
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(form.webhook_token || "");
      setStatus("Токен скопирован.");
    } catch {
      setStatus("Не удалось скопировать токен.");
    }
  }

  async function startSimulation() {
    setSimBusy(true);
    setSimLog([]);
    setSimSessionId(null);
    try {
      const res = await authFetch(`${API_URL}/voice/simulate/`, {
        method: "POST",
        body: JSON.stringify({ caller_phone: "+79000000001" }),
        headers: { "X-Voice-Token": form.webhook_token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.detail || "Не удалось начать тест.");
        return;
      }
      setSimSessionId(data.session_id);
      setSimLog([
        { role: "assistant", text: data.say || "" },
      ]);
    } finally {
      setSimBusy(false);
    }
  }

  async function sendSimTurn(e) {
    e.preventDefault();
    const text = simInput.trim();
    if (!text || !simSessionId) return;
    setSimBusy(true);
    setSimLog((prev) => [...prev, { role: "user", text }]);
    setSimInput("");
    try {
      const res = await authFetch(`${API_URL}/voice/session/${simSessionId}/turn/`, {
        method: "POST",
        body: JSON.stringify({ text }),
        headers: { "X-Voice-Token": form.webhook_token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data.detail || "Ошибка диалога.");
        return;
      }
      setSimLog((prev) => [...prev, { role: "assistant", text: data.say || "" }]);
      if (data.booking_id) {
        setStatus(`Тест: создана запись #${data.booking_id}.`);
        load();
      }
    } finally {
      setSimBusy(false);
    }
  }

  return (
    <section className="voice-admin-panel">
      <h3>Голосовой администратор</h3>
      <p className="muted small">
        ИИ принимает звонки, подбирает окна по календарю и создаёт запись. Подключите облачную АТС (Mango, Novofon) —
        webhook на наш сервер. Без YandexGPT работает упрощённый сценарий.
      </p>

      <form onSubmit={saveSettings} className="form">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            onChange={(e) => setForm((p) => ({ ...p, enabled: e.target.checked }))}
          />
          Включить голосового администратора
        </label>
        <label className="field-label">
          Номер салона (для сопоставления входящих)
          <input
            value={form.inbound_phone}
            onChange={(e) => setForm((p) => ({ ...p, inbound_phone: e.target.value }))}
            placeholder="+74951234567"
          />
        </label>
        <label className="field-label">
          Перевод на живого администратора
          <input
            value={form.transfer_phone}
            onChange={(e) => setForm((p) => ({ ...p, transfer_phone: e.target.value }))}
            placeholder="+7495… или добавочный"
          />
        </label>
        <label className="field-label">
          Приветствие
          <textarea
            rows={3}
            value={form.greeting_text}
            onChange={(e) => setForm((p) => ({ ...p, greeting_text: e.target.value }))}
          />
        </label>
        <label className="field-label" htmlFor="voice-ats">
          Тип АТС
        </label>
        <select
          id="voice-ats"
          value={form.ats_provider}
          onChange={(e) => setForm((p) => ({ ...p, ats_provider: e.target.value }))}
        >
          {ATS_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.tts_enabled)}
            onChange={(e) => setForm((p) => ({ ...p, tts_enabled: e.target.checked }))}
            disabled={!form.speechkit_ready}
          />
          Озвучивать ответы (Yandex SpeechKit → say_audio_base64 в webhook)
        </label>
        {!form.speechkit_ready ? (
          <p className="muted small">SpeechKit: добавьте YANDEX_SPEECHKIT_API_KEY на сервере (TTS и распознавание речи).</p>
        ) : (
          <p className="muted small">
            SpeechKit: TTS в ответе webhook; если АТС присылает audio_base64 без text — распознаём автоматически.
          </p>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.confirm_outbound_enabled)}
            onChange={(e) => setForm((p) => ({ ...p, confirm_outbound_enabled: e.target.checked }))}
          />
          Исходящие звонки для подтверждения записи
        </label>
        {form.ats_provider === "mango" || form.confirm_outbound_enabled ? (
          <>
            <h4 className="voice-mango-head">Mango Office (исходящие)</h4>
            <label className="field-label">
              API key (vpbx_api_key)
              <input
                type="password"
                autoComplete="off"
                value={form.mango_api_key}
                onChange={(e) => setForm((p) => ({ ...p, mango_api_key: e.target.value }))}
                placeholder={form.has_mango ? "••••••••" : ""}
              />
            </label>
            <label className="field-label">
              API salt (vpbx_api_salt)
              <input
                type="password"
                autoComplete="off"
                value={form.mango_api_salt}
                onChange={(e) => setForm((p) => ({ ...p, mango_api_salt: e.target.value }))}
                placeholder={form.has_mango ? "••••••••" : ""}
              />
            </label>
            <label className="field-label">
              Исходящая линия (номер салона)
              <input
                value={form.mango_line_number}
                onChange={(e) => setForm((p) => ({ ...p, mango_line_number: e.target.value }))}
                placeholder="+7495…"
              />
            </label>
            <label className="field-label">
              Добавочный (опционально)
              <input
                value={form.mango_extension}
                onChange={(e) => setForm((p) => ({ ...p, mango_extension: e.target.value }))}
                placeholder="101"
              />
            </label>
          </>
        ) : null}
        <button type="submit">Сохранить</button>
        <p className="status">{status}</p>
      </form>

      {form.webhook_token ? (
        <div className="voice-webhook-block form">
          <p className="muted small">
            <strong>Webhook URL:</strong> {webhookUrl}
          </p>
          <p className="muted small">
            Заголовок: <code>X-Voice-Token</code>
          </p>
          <div className="voice-token-row">
            <input readOnly value={form.webhook_token} aria-label="Voice webhook token" />
            <button type="button" className="ghost-btn" onClick={copyToken}>
              Копировать токен
            </button>
          </div>
        </div>
      ) : null}

      <div className="voice-sim-block">
        <h4>Тест без телефона</h4>
        <button type="button" className="ghost-btn" onClick={startSimulation} disabled={simBusy || !form.webhook_token}>
          Начать тестовый звонок
        </button>
        {simLog.length > 0 && (
          <ul className="voice-sim-log">
            {simLog.map((m, i) => (
              <li key={i} className={`voice-sim-line voice-sim-line--${m.role}`}>
                <strong>{m.role === "user" ? "Клиент" : "Администратор"}:</strong> {m.text}
              </li>
            ))}
          </ul>
        )}
        {simSessionId ? (
          <form onSubmit={sendSimTurn} className="voice-sim-input-row">
            <input
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="Например: маникюр завтра к Лене после шести"
              disabled={simBusy}
            />
            <button type="submit" disabled={simBusy || !simInput.trim()}>
              Отправить
            </button>
          </form>
        ) : null}
      </div>

      {form.confirm_outbound_enabled ? (
        <div className="voice-outbound-block">
          <h4>Подтверждение записей</h4>
          {pendingOutbound.length > 0 ? (
            <ul className="list">
              {pendingOutbound.map((b) => (
                <li key={b.id} className="voice-outbound-row">
                  <span>
                    #{b.id} · {b.client_phone || "—"} · {b.service_name} · {b.starts_at_label}
                  </span>
                  <button type="button" className="ghost-btn" onClick={() => runOutbound(b.id)}>
                    Позвонить
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small">Нет записей с телефоном на ближайшие сутки.</p>
          )}
          <button type="button" className="ghost-btn" onClick={() => runOutbound()} disabled={!form.has_mango}>
            Обзвонить всех
          </button>
          {!form.has_mango ? (
            <p className="muted small">Сохраните ключи Mango для исходящих звонков.</p>
          ) : null}
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <div className="voice-sessions-block">
          <h4>Последние звонки</h4>
          <ul className="list voice-sessions-list">
            {sessions.slice(0, 15).map((s) => (
              <li key={s.id}>
                <span>{s.caller_phone || "—"}</span>
                <span className="muted small">
                  {s.status}
                  {s.booking_id ? ` · запись #${s.booking_id}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
