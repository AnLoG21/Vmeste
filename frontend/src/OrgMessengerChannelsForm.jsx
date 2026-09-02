/** Каналы уведомлений организации (Telegram, MAX, WhatsApp, SMS). */
export default function OrgMessengerChannelsForm({
  form,
  onChange,
  saveStatus,
  telegramLinkInfo,
  onLoadTelegramLink,
  onRefreshTelegramLink,
  onUnlinkTelegram,
}) {
  const setForm = (patch) => onChange((prev) => ({ ...prev, ...patch }));

  return (
    <>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(form.enable_telegram)}
          onChange={(e) => setForm({ enable_telegram: e.target.checked })}
        />
        Telegram
      </label>
      {form.enable_telegram ? (
        <>
          {form.has_platform_telegram ? (
            <p className="muted small">
              Используется бот платформы. Достаточно указать Chat ID организации. Свой token — только если нужен
              отдельный бот.
            </p>
          ) : null}
          <label className="field-label" htmlFor="org-tg-bot-token">
            Bot token{form.has_platform_telegram ? " (свой, необязательно)" : ""}
          </label>
          <input
            id="org-tg-bot-token"
            type="password"
            autoComplete="new-password"
            value={form.telegram_bot_token}
            onChange={(e) => setForm({ telegram_bot_token: e.target.value })}
            placeholder={form.has_org_telegram_token || form.has_platform_telegram ? "••••••••" : ""}
          />
          <label className="field-label" htmlFor="org-tg-chat-id">
            Chat ID (чат организации)
          </label>
          <input
            id="org-tg-chat-id"
            type="text"
            value={form.telegram_notify_chat_id}
            onChange={(e) => setForm({ telegram_notify_chat_id: e.target.value })}
            placeholder="Привяжите через бота или вставьте вручную"
          />
          <div className="row-2">
            <button type="button" className="ghost-btn" onClick={onLoadTelegramLink}>
              Привязать через бота
            </button>
            <button type="button" className="ghost-btn" onClick={onRefreshTelegramLink}>
              Проверить привязку
            </button>
            {telegramLinkInfo?.linked || form.telegram_notify_chat_id ? (
              <button type="button" className="ghost-btn" onClick={onUnlinkTelegram}>
                Отвязать
              </button>
            ) : null}
          </div>
          {telegramLinkInfo ? (
            <div>
              <p
                className={`telegram-bind-status ${
                  telegramLinkInfo.linked || form.telegram_notify_chat_id
                    ? "telegram-bind-status--ok"
                    : "telegram-bind-status--bad"
                }`}
              >
                <span className="telegram-bind-mark" aria-hidden="true">
                  {telegramLinkInfo.linked || form.telegram_notify_chat_id ? "✓" : "✕"}
                </span>
                <span>
                  {telegramLinkInfo.linked || form.telegram_notify_chat_id
                    ? `Привязан. Chat ID: ${form.telegram_notify_chat_id || telegramLinkInfo.telegram_notify_chat_id}${
                        telegramLinkInfo.bot_username ? ` @${telegramLinkInfo.bot_username}` : ""
                      }`
                    : "Не привязан."}
                </span>
              </p>
              {telegramLinkInfo.deep_link ? (
                <a href={telegramLinkInfo.deep_link} target="_blank" rel="noreferrer">
                  Открыть бота и нажать Start
                </a>
              ) : (
                <p className="muted small">{telegramLinkInfo.hint}</p>
              )}
              <p className="muted small">
                Или напишите боту /start или /chatid — он пришлёт Chat ID для ручного ввода выше. Если бот молчит (VPS
                может не видеть Telegram), нажмите «Проверить привязку» после Start.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(form.enable_max)}
          onChange={(e) => setForm({ enable_max: e.target.checked })}
        />
        MAX
      </label>
      {form.enable_max ? (
        <>
          <label className="field-label" htmlFor="org-max-bot-token">
            Bot token
          </label>
          <input
            id="org-max-bot-token"
            type="password"
            autoComplete="new-password"
            value={form.max_bot_token}
            onChange={(e) => setForm({ max_bot_token: e.target.value })}
            placeholder={form.has_max ? "••••••••" : ""}
          />
          <label className="field-label" htmlFor="org-max-chat-id">
            Chat ID
          </label>
          <input
            id="org-max-chat-id"
            type="text"
            value={form.max_notify_chat_id}
            onChange={(e) => setForm({ max_notify_chat_id: e.target.value })}
          />
        </>
      ) : null}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(form.enable_whatsapp)}
          onChange={(e) => setForm({ enable_whatsapp: e.target.checked })}
        />
        WhatsApp (Green-API)
      </label>
      {form.enable_whatsapp ? (
        <>
          <label className="field-label" htmlFor="org-wa-api-url">
            API URL
          </label>
          <input
            id="org-wa-api-url"
            type="text"
            value={form.wa_api_url}
            onChange={(e) => setForm({ wa_api_url: e.target.value })}
          />
          <label className="field-label" htmlFor="org-wa-id-instance">
            idInstance
          </label>
          <input
            id="org-wa-id-instance"
            type="text"
            value={form.wa_id_instance}
            onChange={(e) => setForm({ wa_id_instance: e.target.value })}
          />
          <label className="field-label" htmlFor="org-wa-api-token">
            apiTokenInstance
          </label>
          <input
            id="org-wa-api-token"
            type="password"
            autoComplete="new-password"
            value={form.wa_api_token}
            onChange={(e) => setForm({ wa_api_token: e.target.value })}
            placeholder={form.has_whatsapp ? "••••••••" : ""}
          />
        </>
      ) : null}
      <label className="checkbox">
        <input
          type="checkbox"
          checked={Boolean(form.enable_sms)}
          onChange={(e) => setForm({ enable_sms: e.target.checked })}
        />
        SMS (SMS.ru)
      </label>
      {form.enable_sms ? (
        <>
          <label className="field-label" htmlFor="org-sms-api-id">
            api_id организации (если пусто — ключ платформы)
          </label>
          <input
            id="org-sms-api-id"
            type="password"
            autoComplete="new-password"
            value={form.sms_api_id}
            onChange={(e) => setForm({ sms_api_id: e.target.value })}
            placeholder={form.has_sms_org ? "••••••••" : ""}
          />
        </>
      ) : null}
      <button type="submit">Сохранить каналы</button>
      <p className="status">{saveStatus}</p>
    </>
  );
}
