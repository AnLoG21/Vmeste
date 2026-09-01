import { useCallback, useEffect, useRef, useState } from "react";

const ATS_OPTIONS = [
  ["asterisk", "SIP-номер (рекомендуется, ~200–300 ₽/мес у оператора)"],
  ["generic", "Пока без телефона (только тест в браузере)"],
  ["mango", "Mango Office (платная АТС)"],
  ["novofon", "Novofon / UIS (платная АТС)"],
];

const SIP_OPERATORS_HINT = "Телфин, МТТ, Мегафон Бизнес, Билайн Бизнес и др.";

const EMPTY_FORM = {
  enabled: false,
  inbound_phone: "",
  transfer_phone: "",
  greeting_text: "",
  ats_provider: "asterisk",
  confirm_outbound_enabled: false,
  tts_enabled: false,
  legal_ack: false,
  caller_disclosure: "",
  mango_api_key: "",
  mango_api_salt: "",
  mango_line_number: "",
  mango_extension: "",
  has_mango: false,
  has_sip: false,
  speechkit_ready: false,
  webhook_token: "",
  sip_server: "",
  sip_username: "",
  sip_password: "",
  sip_auth_user: "",
  sip_did: "",
  voice_minutes_quota: 30,
  voice_minutes_used: 0,
  voice_minutes_left: 30,
};

function mergeSettings(prev, data) {
  return {
    ...prev,
    enabled: Boolean(data.enabled),
    inbound_phone: data.inbound_phone ?? "",
    transfer_phone: data.transfer_phone ?? "",
    greeting_text: data.greeting_text ?? "",
    ats_provider: data.ats_provider || "asterisk",
    confirm_outbound_enabled: Boolean(data.confirm_outbound_enabled),
    tts_enabled: Boolean(data.tts_enabled),
    legal_ack: Boolean(data.legal_ack),
    caller_disclosure: data.caller_disclosure ?? "",
    mango_line_number: data.mango_line_number ?? "",
    mango_extension: data.mango_extension ?? "",
    has_mango: Boolean(data.has_mango),
    has_sip: Boolean(data.has_sip),
    speechkit_ready: Boolean(data.speechkit_ready),
    webhook_token: data.webhook_token ?? "",
    sip_server: data.sip_server ?? "",
    sip_username: data.sip_username ?? "",
    sip_auth_user: data.sip_auth_user ?? "",
    sip_did: data.sip_did ?? "",
    mango_api_key: "",
    mango_api_salt: "",
    sip_password: "",
    voice_minutes_quota: data.voice_minutes_quota ?? 30,
    voice_minutes_used: data.voice_minutes_used ?? 0,
    voice_minutes_left: data.voice_minutes_left ?? 0,
  };
}

/**
 * Кабинет салона: голосовой администратор — SIP/Asterisk, тест, журнал.
 */
export default function VoiceAdminPanel({ authFetch, API_URL, apiOrigin = "", onOpenSubscriptions }) {
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
      const body = {
        enabled: Boolean(form.enabled),
        inbound_phone: form.inbound_phone || "",
        transfer_phone: form.transfer_phone || "",
        greeting_text: form.greeting_text || "",
        ats_provider: form.ats_provider || "asterisk",
        confirm_outbound_enabled: Boolean(form.confirm_outbound_enabled),
        tts_enabled: Boolean(form.tts_enabled),
        legal_ack: Boolean(form.legal_ack),
        caller_disclosure: form.caller_disclosure || "",
        mango_line_number: form.mango_line_number || "",
        mango_extension: form.mango_extension || "",
        sip_server: form.sip_server || "",
        sip_username: form.sip_username || "",
        sip_auth_user: form.sip_auth_user || "",
        sip_did: form.sip_did || form.inbound_phone || "",
      };
      if ((form.sip_password || "").trim()) body.sip_password = form.sip_password.trim();

      const res = await fetchAuth(`${api}/voice/settings/`, {
        method: "PATCH",
        body: JSON.stringify(body),
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
      if (form.ats_provider === "asterisk" && merged.has_sip) {
        setStatus("SIP привязан. Звонки на ваш номер будут принимать робота (после включения телефонии на сервере).");
      } else {
        setStatus("Настройки сохранены.");
      }
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

  const isAsterisk = form.ats_provider === "asterisk";
  const step1Done = Boolean(form.enabled) && Boolean(form.legal_ack);
  const step2Done = step1Done && Boolean((form.greeting_text || "").trim());
  const step3Done = isAsterisk ? form.has_sip : step2Done && form.ats_provider !== "generic";

  return (
    <section className="voice-admin-panel">
      <h3>Голосовой администратор</h3>
      <p className="muted small voice-lead">
        Робот записывает клиентов по телефону. Mango и Novofon не нужны: достаточно недорогого SIP-номера у любого
        оператора. Сначала проверьте робота в тесте — это бесплатно.
      </p>

      {isAsterisk ? (
        <div className="voice-onboard-box">
          <h4 className="voice-section-head">Как подключить телефон</h4>
          <ol className="voice-onboard-steps">
            <li>
              <strong>Купите SIP-номер</strong> у оператора ({SIP_OPERATORS_HINT}) — обычно{" "}
              <strong>200–300 ₽/мес</strong> за номер (без дорогой АТС).
            </li>
            <li>
              Получите от оператора <strong>SIP-реквизиты</strong>: сервер, логин, пароль и сам номер.
            </li>
            <li>
              Введите их ниже и нажмите <strong>«Сохранить»</strong> — платформа привяжет номер к роботу.
            </li>
            <li>Клиенты звонят на ваш номер → отвечает голосовой администратор.</li>
          </ol>
          <p className="muted small voice-wallet-hint">
            Распознавание речи (SpeechKit) списывается с лимита минут. Сейчас{" "}
            <strong>{form.voice_minutes_left}</strong> мин из {form.voice_minutes_quota} в месяц. Купить, продлить или
            сменить тариф — в разделе «Подписки».
            {typeof onOpenSubscriptions === "function" ? (
              <>
                {" "}
                <button type="button" className="linkish-btn" onClick={onOpenSubscriptions}>
                  Открыть тарифы минут
                </button>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <ol className="voice-steps muted small">
        <li className={step1Done ? "voice-steps__done" : ""}>
          <strong>Шаг 1.</strong> Включите администратора, подтвердите 152-ФЗ и сохраните приветствие.
        </li>
        <li className={step2Done ? "voice-steps__done" : ""}>
          <strong>Шаг 2.</strong> Пройдите тест без телефона ниже.
        </li>
        {isAsterisk ? (
          <li className={step3Done ? "voice-steps__done" : ""}>
            <strong>Шаг 3.</strong> Купите SIP-номер и привяжите реквизиты в форме ниже.
          </li>
        ) : form.ats_provider !== "generic" ? (
          <li>
            <strong>Шаг 3.</strong> Настройте интеграцию с выбранной АТС (Mango / Novofon).
          </li>
        ) : null}
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

        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.legal_ack)}
            onChange={(e) => patchForm((p) => ({ ...p, legal_ack: e.target.checked }))}
          />
          Подтверждаю: звонящий уведомляется об обработке голоса, данные обрабатываются по 152-ФЗ
          (Яндекс SpeechKit). Без галочки включить робота нельзя.
        </label>

        <label className="field-label" htmlFor="voice-inbound-phone">
          Телефон салона (для справки)
        </label>
        <p className="field-hint field-hint--below-label">Тот же номер, который укажете в SIP-поле ниже</p>
        <input
          id="voice-inbound-phone"
          type="tel"
          autoComplete="tel"
          value={form.inbound_phone ?? ""}
          onChange={(e) => patchForm((p) => ({ ...p, inbound_phone: e.target.value }))}
          placeholder="+7 495 123-45-67"
        />

        <label className="field-label" htmlFor="voice-transfer-phone">
          Перевод на живого администратора
        </label>
        <p className="field-hint field-hint--below-label">Если клиент просит человека</p>
        <input
          id="voice-transfer-phone"
          type="tel"
          autoComplete="tel"
          value={form.transfer_phone ?? ""}
          onChange={(e) => patchForm((p) => ({ ...p, transfer_phone: e.target.value }))}
          placeholder="+7 495 …"
        />

        <label className="field-label" htmlFor="voice-disclosure">
          Уведомление звонящего (152-ФЗ)
        </label>
        <p className="field-hint field-hint--below-label">Произносится в начале звонка перед приветствием</p>
        <textarea
          id="voice-disclosure"
          rows={2}
          value={form.caller_disclosure ?? ""}
          onChange={(e) => patchForm((p) => ({ ...p, caller_disclosure: e.target.value }))}
          placeholder="Разговор обрабатывается голосовым ассистентом…"
        />

        <label className="field-label" htmlFor="voice-greeting">
          Первая фраза при звонке
        </label>
        <textarea
          id="voice-greeting"
          rows={3}
          value={form.greeting_text ?? ""}
          onChange={(e) => patchForm((p) => ({ ...p, greeting_text: e.target.value }))}
          placeholder="Здравствуйте! Это салон … Помогу записаться."
        />

        <label className="field-label" htmlFor="voice-ats">
          Способ подключения телефона
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

        {isAsterisk ? (
          <>
            <h4 className="voice-section-head">SIP-номер (от оператора связи)</h4>
            {form.has_sip ? (
              <p className="voice-status-ok small">SIP привязан — робот готов принимать звонки на ваш номер.</p>
            ) : (
              <p className="voice-status-warn small">Заполните реквизиты после покупки SIP-номера.</p>
            )}
            <label className="field-label">
              SIP-сервер
              <span className="field-hint">Например sip.telphin.ru или sip.mtt.ru</span>
              <input
                value={form.sip_server ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, sip_server: e.target.value }))}
                placeholder="sip.example.ru"
              />
            </label>
            <label className="field-label">
              SIP-логин
              <input
                value={form.sip_username ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, sip_username: e.target.value }))}
                placeholder="логин из кабинета оператора"
              />
            </label>
            <label className="field-label">
              SIP-пароль
              <input
                type="password"
                autoComplete="off"
                value={form.sip_password ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, sip_password: e.target.value }))}
                placeholder={form.has_sip ? "Уже сохранён — введите только чтобы заменить" : ""}
              />
            </label>
            <label className="field-label">
              Логин авторизации (если отличается)
              <input
                value={form.sip_auth_user ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, sip_auth_user: e.target.value }))}
                placeholder="необязательно"
              />
            </label>
            <label className="field-label">
              Купленный номер (DID)
              <span className="field-hint">На этот номер звонят клиенты</span>
              <input
                type="tel"
                value={form.sip_did ?? ""}
                onChange={(e) => patchForm((p) => ({ ...p, sip_did: e.target.value }))}
                placeholder="+7 495 …"
              />
            </label>
          </>
        ) : null}

        {form.speechkit_ready && form.ats_provider !== "generic" ? (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(form.tts_enabled)}
              onChange={(e) => patchForm((p) => ({ ...p, tts_enabled: e.target.checked }))}
            />
            Озвучивать ответы робота голосом
          </label>
        ) : null}

        {form.ats_provider === "mango" ? (
          <>
            <h4 className="voice-section-head">Mango Office (опционально)</h4>
            <p className="muted small">Платная облачная АТС. Для экономии используйте SIP-номер выше.</p>
            <label className="field-label">
              Mango API key
              <input
                type="password"
                autoComplete="off"
                value={form.mango_api_key}
                onChange={(e) => patchForm((p) => ({ ...p, mango_api_key: e.target.value }))}
                placeholder={form.has_mango ? "••••••••" : ""}
              />
            </label>
            <label className="field-label">
              Mango API salt
              <input
                type="password"
                autoComplete="off"
                value={form.mango_api_salt}
                onChange={(e) => patchForm((p) => ({ ...p, mango_api_salt: e.target.value }))}
                placeholder={form.has_mango ? "••••••••" : ""}
              />
            </label>
          </>
        ) : null}

        {form.ats_provider === "mango" || isAsterisk ? (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.confirm_outbound_enabled)}
                onChange={(e) => patchForm((p) => ({ ...p, confirm_outbound_enabled: e.target.checked }))}
              />
              Исходящие звонки «подтверждаете визит?»
            </label>
            {isAsterisk ? (
              <p className="muted small">
                Для SIP исходящие идут через Asterisk на сервере. Нужен привязанный номер и включённая телефония.
              </p>
            ) : null}
          </>
        ) : null}

        <button type="submit" disabled={saving}>
          {saving ? "Сохраняем…" : "Сохранить настройки"}
        </button>
        <p className="status">{status}</p>
      </form>

      <div className="voice-sim-block">
        <h4 className="voice-section-head">Тест без телефона (бесплатно)</h4>
        <p className="muted small">Проверьте услуги и календарь до покупки SIP-номера.</p>
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
              placeholder="Например: маникюр завтра к Лене"
              disabled={simBusy}
            />
            <button type="submit" disabled={simBusy || !simInput.trim()}>
              Отправить
            </button>
          </form>
        ) : null}
      </div>

      {form.confirm_outbound_enabled && (form.ats_provider === "mango" || isAsterisk) ? (
        <div className="voice-outbound-block">
          <h4 className="voice-section-head">Записи для обзвона</h4>
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
          <button
            type="button"
            className="ghost-btn"
            onClick={() => runOutbound()}
            disabled={form.ats_provider === "mango" ? !form.has_mango : !form.has_sip}
          >
            Обзвонить всех
          </button>
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
