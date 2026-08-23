import { useCallback, useEffect, useRef, useState } from "react";

const ATS_OPTIONS = [
  ["generic", "Пока без АТС (только тест в браузере)"],
  ["mango", "Mango Office"],
  ["novofon", "Novofon / UIS"],
];

const EMPTY_FORM = {
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
};

function mergeSettings(prev, data) {
  return {
    ...prev,
    enabled: Boolean(data.enabled),
    inbound_phone: data.inbound_phone ?? "",
    transfer_phone: data.transfer_phone ?? "",
    greeting_text: data.greeting_text ?? "",
    ats_provider: data.ats_provider || "generic",
    confirm_outbound_enabled: Boolean(data.confirm_outbound_enabled),
    tts_enabled: Boolean(data.tts_enabled),
    mango_line_number: data.mango_line_number ?? "",
    mango_extension: data.mango_extension ?? "",
    has_mango: Boolean(data.has_mango),
    speechkit_ready: Boolean(data.speechkit_ready),
    webhook_token: data.webhook_token ?? "",
    mango_api_key: "",
    mango_api_salt: "",
  };
}

/**
 * Кабинет салона: голосовой администратор — настройки, webhook, тест диалога, журнал звонков.
 */
export default function VoiceAdminPanel({ authFetch, API_URL, apiOrigin = "" }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("");
  const [sessions, setSessions] = useState([]);
  const [simSessionId, setSimSessionId] = useState(null);
  const [simLog, setSimLog] = useState([]);
  const [simInput, setSimInput] = useState("");
  const [simBusy, setSimBusy] = useState(false);
  const [pendingOutbound, setPendingOutbound] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const authFetchRef = useRef(authFetch);
  const apiUrlRef = useRef(API_URL);
  const formDirtyRef = useRef(false);

  authFetchRef.current = authFetch;
  apiUrlRef.current = API_URL;

  const webhookUrl = `${(apiOrigin || API_URL.replace(/\/api\/?$/, "")).replace(/\/$/, "")}/api/voice/webhook/inbound/`;

  const patchForm = useCallback((updater) => {
    formDirtyRef.current = true;
    setForm(updater);
  }, []);

  const loadSessionsAndOutbound = useCallback(async () => {
    const fetchAuth = authFetchRef.current;
    const api = apiUrlRef.current;
    const [sessRes, outRes] = await Promise.all([
      fetchAuth(`${api}/voice/sessions/`),
      fetchAuth(`${api}/voice/outbound/pending/`),
    ]);
    if (sessRes.ok) {
      const data = await sessRes.json();
      setSessions(Array.isArray(data) ? data : []);
    }
    if (outRes.ok) {
      const data = await outRes.json();
      setPendingOutbound(Array.isArray(data?.bookings) ? data.bookings : []);
    }
  }, []);

  const loadSettings = useCallback(async ({ force = false } = {}) => {
    const fetchAuth = authFetchRef.current;
    const api = apiUrlRef.current;
    if (!force && formDirtyRef.current) {
      await loadSessionsAndOutbound();
      return;
    }
    setLoading(true);
    try {
      const sRes = await fetchAuth(`${api}/voice/settings/`);
      if (sRes.ok) {
        const data = await sRes.json();
        setForm((p) => mergeSettings(p, data));
      }
      await loadSessionsAndOutbound();
    } finally {
      setLoading(false);
    }
  }, [loadSessionsAndOutbound]);

  useEffect(() => {
    loadSettings({ force: true });
  }, [loadSettings]);

  async function saveSettings(e) {
    e.preventDefault();
    setSaving(true);
    setStatus("Сохраняем…");
    try {
      const fetchAuth = authFetchRef.current;
      const api = apiUrlRef.current;
      const res = await fetchAuth(`${api}/voice/settings/`, {
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
      let merged = data;
      if (Object.keys(mangoPatch).length) {
        const res2 = await fetchAuth(`${api}/voice/settings/`, {
          method: "PATCH",
          body: JSON.stringify(mangoPatch),
        });
        if (res2.ok) merged = await res2.json();
      }
      formDirtyRef.current = false;
      setForm((p) => mergeSettings(p, merged));
      setStatus("Настройки сохранены.");
    } finally {
      setSaving(false);
    }
  }

  async function runOutbound(bookingId = null) {
    setStatus("Запускаем обзвон…");
    const body = bookingId ? { booking_id: bookingId } : { limit: 10 };
    const res = await authFetchRef.current(`${apiUrlRef.current}/voice/outbound/run/`, {
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
    await loadSessionsAndOutbound();
  }

  async function copyText(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text || "");
      setStatus(okMessage);
    } catch {
      setStatus("Не удалось скопировать — выделите текст вручную.");
    }
  }

  async function startSimulation() {
    setSimBusy(true);
    setSimLog([]);
    setSimSessionId(null);
    try {
      const res = await authFetchRef.current(`${apiUrlRef.current}/voice/simulate/`, {
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
      setSimLog([{ role: "assistant", text: data.say || "" }]);
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
      const res = await authFetchRef.current(`${apiUrlRef.current}/voice/session/${simSessionId}/turn/`, {
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
        await loadSessionsAndOutbound();
      }
    } finally {
      setSimBusy(false);
    }
  }

  const step1Done = Boolean(form.enabled);
  const step2Done = step1Done && Boolean((form.greeting_text || "").trim());
  const step3Ready = step2Done && Boolean(form.webhook_token);

  return (
    <section className="voice-admin-panel">
      <h3>Голосовой администратор</h3>
      <p className="muted small voice-lead">
        Робот помогает записывать клиентов по телефону. Сначала проверьте работу в тесте ниже — для этого телефония не
        нужна. Подключение Mango или Novofon — только если хотите принимать реальные звонки на номер салона.
      </p>

      <ol className="voice-steps muted small">
        <li className={step1Done ? "voice-steps__done" : ""}>
          <strong>Шаг 1.</strong> Включите администратора, заполните приветствие и сохраните.
        </li>
        <li className={step2Done ? "voice-steps__done" : ""}>
          <strong>Шаг 2.</strong> Пройдите тест без телефона — как будто клиент пишет в чат.
        </li>
        <li className={step3Ready ? "voice-steps__done" : ""}>
          <strong>Шаг 3 (если есть телефония).</strong> Передайте адрес и токен в Mango / Novofon или интегратору.
        </li>
      </ol>

      {loading ? <p className="muted small">Загружаем настройки…</p> : null}

      <form onSubmit={saveSettings} className="form voice-settings-form">
        <h4 className="voice-section-head">Основные настройки</h4>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.enabled)}
            onChange={(e) => patchForm((p) => ({ ...p, enabled: e.target.checked }))}
          />
          Включить голосового администратора
        </label>

        <label className="field-label">
          Телефон салона
          <span className="field-hint">Ваш городской или мобильный номер, на который звонят клиенты</span>
          <input
            type="tel"
            autoComplete="tel"
            value={form.inbound_phone ?? ""}
            onChange={(e) => patchForm((p) => ({ ...p, inbound_phone: e.target.value }))}
            placeholder="+7 495 123-45-67"
          />
        </label>

        <label className="field-label">
          Перевод на живого администратора
          <span className="field-hint">Куда переводить звонок, если клиент просит человека</span>
          <input
            type="tel"
            autoComplete="tel"
            value={form.transfer_phone ?? ""}
            onChange={(e) => patchForm((p) => ({ ...p, transfer_phone: e.target.value }))}
            placeholder="+7 495 … или добавочный 101"
          />
        </label>

        <label className="field-label">
          Первая фраза при звонке
          <span className="field-hint">Робот произнесёт это, когда клиент дозвонится</span>
          <textarea
            rows={3}
            value={form.greeting_text ?? ""}
            onChange={(e) => patchForm((p) => ({ ...p, greeting_text: e.target.value }))}
            placeholder="Здравствуйте! Это салон … Помогу записаться. Скажите, какая услуга и когда вам удобно."
          />
        </label>

        <label className="field-label" htmlFor="voice-ats">
          Телефония (АТС)
          <span className="field-hint">Выберите провайдера или оставьте «только тест», пока не подключили АТС</span>
        </label>
        <select
          id="voice-ats"
          value={form.ats_provider}
          onChange={(e) => patchForm((p) => ({ ...p, ats_provider: e.target.value }))}
        >
          {ATS_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>

        {form.speechkit_ready ? (
          <>
            <h4 className="voice-section-head">Голосовые ответы по телефону</h4>
            <p className="voice-status-ok small">
              На платформе включена озвучка — робот может отвечать голосом через телефонию.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.tts_enabled)}
                onChange={(e) => patchForm((p) => ({ ...p, tts_enabled: e.target.checked }))}
              />
              Озвучивать ответы робота при звонках
            </label>
          </>
        ) : null}

        <h4 className="voice-section-head">Напоминания по телефону</h4>
        <p className="muted small field-hint">
          Робот может сам звонить клиентам и спрашивать, подтверждают ли визит. Нужна телефония Mango.
        </p>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.confirm_outbound_enabled)}
            onChange={(e) => patchForm((p) => ({ ...p, confirm_outbound_enabled: e.target.checked }))}
          />
          Звонить клиентам накануне и спрашивать «подтверждаете визит?»
        </label>

        {(form.ats_provider === "mango" || form.confirm_outbound_enabled) && (
          <>
            <p className="muted small">
              Ключи Mango — в личном кабинете{" "}
              <a href="https://www.mango-office.ru/products/virtualnaya-ats/" target="_blank" rel="noreferrer">
                Mango Office
              </a>{" "}
              → <strong>Интеграции → API</strong>.
            </p>
            <label className="field-label">
              Mango API key
              <input
                type="password"
                autoComplete="off"
                value={form.mango_api_key}
                onChange={(e) => patchForm((p) => ({ ...p, mango_api_key: e.target.value }))}
                placeholder={form.has_mango ? "Уже сохранён — введите только чтобы заменить" : "vpbx_api_key из Mango"}
              />
            </label>
            <label className="field-label">
              Mango API salt
              <input
                type="password"
                autoComplete="off"
                value={form.mango_api_salt}
                onChange={(e) => patchForm((p) => ({ ...p, mango_api_salt: e.target.value }))}
                placeholder={form.has_mango ? "Уже сохранён — введите только чтобы заменить" : "vpbx_api_salt из Mango"}
              />
            </label>
            <label className="field-label">
              Номер линии для исходящих
              <span className="field-hint">Номер салона, с которого Mango звонит клиентам</span>
              <input
                type="tel"
                value={form.mango_line_number ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, mango_line_number: e.target.value }))}
                placeholder="+7 495 …"
              />
            </label>
            <label className="field-label">
              Добавочный Mango (необязательно)
              <input
                value={form.mango_extension ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, mango_extension: e.target.value }))}
                placeholder="101"
              />
            </label>
          </>
        )}

        <button type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить настройки"}
        </button>
        <p className="status">{status}</p>
      </form>

      <div className="voice-sim-block">
        <h4 className="voice-section-head">Тест без телефона</h4>
        <p className="muted small">
          Проверьте, что в календаре есть услуги и свободные окна. Напишите фразу как клиент — робот должен предложить
          время и записать на «да».
        </p>
        <button type="button" className="ghost-btn" onClick={startSimulation} disabled={simBusy || !form.webhook_token}>
          Начать тестовый диалог
        </button>
        {simLog.length > 0 && (
          <ul className="voice-sim-log">
            {simLog.map((m, i) => (
              <li key={i} className={`voice-sim-line voice-sim-line--${m.role}`}>
                <strong>{m.role === "user" ? "Клиент" : "Робот"}:</strong> {m.text}
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

      {form.webhook_token && form.ats_provider !== "generic" ? (
        <div className="voice-webhook-block">
          <h4 className="voice-section-head">Данные для подключения телефонии</h4>
          <p className="muted small">
            Передайте эти данные в Mango / Novofon или специалисту, который настраивает телефонию. Без телефонии тест
            выше уже работает.
          </p>
          <p className="muted small">
            <strong>Адрес:</strong>
          </p>
          <div className="voice-token-row">
            <input readOnly value={webhookUrl} aria-label="Voice webhook URL" />
            <button type="button" className="ghost-btn" onClick={() => copyText(webhookUrl, "Адрес скопирован.")}>
              Копировать URL
            </button>
          </div>
          <p className="muted small">
            <strong>Код доступа (заголовок</strong> <code>X-Voice-Token</code>
            <strong>):</strong>
          </p>
          <div className="voice-token-row">
            <input readOnly value={form.webhook_token} aria-label="Voice webhook token" />
            <button type="button" className="ghost-btn" onClick={() => copyText(form.webhook_token, "Код скопирован.")}>
              Копировать код
            </button>
          </div>
        </div>
      ) : null}

      {form.confirm_outbound_enabled ? (
        <div className="voice-outbound-block">
          <h4 className="voice-section-head">Записи для обзвона</h4>
          <p className="muted small">Клиенты с телефоном на ближайшие 36 часов. Нужны ключи Mango и сохранённые настройки.</p>
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
            <p className="muted small">Пока нет подходящих записей (нужен телефон клиента и дата в ближайшие сутки).</p>
          )}
          <button type="button" className="ghost-btn" onClick={() => runOutbound()} disabled={!form.has_mango}>
            Обзвонить всех
          </button>
          {!form.has_mango ? <p className="muted small">Сначала сохраните ключи Mango выше.</p> : null}
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <div className="voice-sessions-block">
          <h4 className="voice-section-head">Журнал звонков</h4>
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
