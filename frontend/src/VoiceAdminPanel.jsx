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
        Робот отвечает на звонки, подбирает свободное время в вашем календаре и создаёт запись. Сначала настройте и
        проверьте в браузере — затем подключите телефонию (Mango / Novofon).
      </p>

      <ol className="voice-steps muted small">
        <li className={step1Done ? "voice-steps__done" : ""}>
          <strong>Шаг 1.</strong> Включите администратора и сохраните настройки.
        </li>
        <li className={step2Done ? "voice-steps__done" : ""}>
          <strong>Шаг 2.</strong> Пройдите тест без телефона ниже.
        </li>
        <li className={step3Ready ? "voice-steps__done" : ""}>
          <strong>Шаг 3.</strong> Скопируйте webhook и токен в настройки АТС.
        </li>
        <li>
          <strong>Шаг 4 (по желанию).</strong> Подключите Yandex GPT + SpeechKit на сервере для «живого» диалога и голоса.
        </li>
      </ol>

      <details className="voice-guide-block">
        <summary>Как получить ключи Yandex Cloud (подробная инструкция)</summary>
        <div className="voice-guide-body muted small">
          <p>
            Ключи добавляются <strong>на сервере</strong> (файл <code>/opt/vmeste/.env</code>), не в этом кабинете. Без
            них робот работает в упрощённом режиме; с ключами — понимает сложные фразы и может озвучивать ответы.
          </p>
          <ol>
            <li>
              Откройте{" "}
              <a href="https://console.cloud.yandex.ru/" target="_blank" rel="noreferrer">
                console.cloud.yandex.ru
              </a>{" "}
              и войдите под Яндекс ID.
            </li>
            <li>
              Слева <strong>Каталоги</strong> → выберите каталог или нажмите <strong>Создать каталог</strong> (например
              «Vmeste»). Скопируйте <strong>ID каталога</strong> — это <code>YANDEX_CLOUD_FOLDER_ID</code> (начинается с{" "}
              <code>b1...</code>).
            </li>
            <li>
              В каталоге: <strong>Сервисные аккаунты</strong> → <strong>Создать сервисный аккаунт</strong> (имя любое, напр.
              <code>vmeste-voice</code>).
            </li>
            <li>
              Откройте аккаунт → вкладка <strong>Роли</strong> → <strong>Назначить роли</strong>:
              <ul>
                <li>
                  <code>ai.languageModels.user</code> — для YandexGPT
                </li>
                <li>
                  <code>ai.speechkit-stt.user</code> и <code>ai.speechkit-tts.user</code> — для SpeechKit
                </li>
              </ul>
              (Если роли не находятся — в поиске ролей введите «languageModels» и «speechkit».)
            </li>
            <li>
              Вкладка <strong>API-ключи</strong> → <strong>Создать API-ключ</strong> → скопируйте ключ (показывается один
              раз). Его можно использовать и для GPT, и для SpeechKit:
              <ul>
                <li>
                  <code>YANDEX_GPT_API_KEY=AQVN...</code>
                </li>
                <li>
                  <code>YANDEX_SPEECHKIT_API_KEY=AQVN...</code> (тот же ключ)
                </li>
              </ul>
            </li>
            <li>
              На VPS по SSH откройте <code>/opt/vmeste/.env</code>, добавьте три строки и перезапустите backend:
              <pre className="voice-guide-pre">{`YANDEX_CLOUD_FOLDER_ID=b1gxxxxxxxxxx
YANDEX_GPT_API_KEY=AQVNxxxxxxxx
YANDEX_SPEECHKIT_API_KEY=AQVNxxxxxxxx

docker compose -f docker-compose.prod.yml up -d --force-recreate web celery_worker celery_beat`}</pre>
            </li>
            <li>
              Обновите эту страницу. Если всё верно, ниже появится зелёная подсказка «SpeechKit на сервере подключён» и
              станет доступен переключатель озвучки ответов.
            </li>
          </ol>
          <p>
            Оплата: Yandex Cloud — pay-as-you-go; для тестов обычно хватает гранта. Следите за расходом в разделе{" "}
            <strong>Биллинг</strong> консоли.
          </p>
        </div>
      </details>

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

        <h4 className="voice-section-head">Голос и речь (Yandex SpeechKit)</h4>

        {form.speechkit_ready ? (
          <p className="voice-status-ok small">SpeechKit на сервере подключён — доступны озвучка и распознавание речи.</p>
        ) : (
          <p className="muted small">
            SpeechKit пока не настроен на сервере. Раскройте инструкцию «Как получить ключи Yandex Cloud» выше.
          </p>
        )}

        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.tts_enabled)}
            onChange={(e) => patchForm((p) => ({ ...p, tts_enabled: e.target.checked }))}
            disabled={!form.speechkit_ready}
          />
          Озвучивать ответы робота (для интеграции с АТС)
        </label>

        <h4 className="voice-section-head">Исходящие звонки (подтверждение записи)</h4>

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
              Для исходящих нужен{" "}
              <a href="https://www.mango-office.ru/products/virtualnaya-ats/" target="_blank" rel="noreferrer">
                Mango Office
              </a>
              : ключи берутся в личном кабинете → <strong>Интеграции → API</strong>.
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
              <span className="field-hint">Тот же номер салона, с которого Mango звонит клиентам</span>
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

      {form.webhook_token ? (
        <div className="voice-webhook-block">
          <h4 className="voice-section-head">Подключение АТС (webhook)</h4>
          <p className="muted small">
            В Mango / Novofon создайте HTTP-запрос на этот адрес при звонке и после распознавания речи клиента.
          </p>
          <p className="muted small">
            <strong>Адрес:</strong>
          </p>
          <div className="voice-token-row">
            <input readOnly value={webhookUrl} aria-label="Voice webhook URL" />
            <button type="button" className="ghost-btn" onClick={() => copyText(webhookUrl, "Адрес webhook скопирован.")}>
              Копировать URL
            </button>
          </div>
          <p className="muted small">
            <strong>Заголовок запроса:</strong> <code>X-Voice-Token</code>
          </p>
          <div className="voice-token-row">
            <input readOnly value={form.webhook_token} aria-label="Voice webhook token" />
            <button type="button" className="ghost-btn" onClick={() => copyText(form.webhook_token, "Токен скопирован.")}>
              Копировать токен
            </button>
          </div>
        </div>
      ) : null}

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
