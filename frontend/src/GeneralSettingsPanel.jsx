import PasswordInput from "./PasswordInput.jsx";
import {
  BOOKMARK_CATALOG,
  bookmarkLabel,
  defaultSubnavBookmarks,
} from "./subnavBookmarks.js";

/** Раздел «Настройки»: тема, закладки, пароль, email, уведомления. */
export default function GeneralSettingsPanel({
  me,
  appTheme,
  setAppTheme,
  replayPlatformTour,
  subnavBookmarks,
  setSubnavBookmarks,
  isBookmarkAvailable,
  toggleSubnavBookmark,
  passwordForm,
  setPasswordForm,
  changePassword,
  passwordResetBusy,
  requestPasswordResetFromSettings,
  emailForm,
  setEmailForm,
  changeEmail,
  resendVerification,
  resendStatus,
  clientNotifyForm,
  setClientNotifyForm,
  saveClientNotifyPrefs,
  clientNotifyStatus,
  telegramLinkInfo,
  loadTelegramLink,
  unlinkTelegram,
}) {
  const role = me?.role;
  const bookmarkOptions = BOOKMARK_CATALOG.filter(
    (b) => role && b.roles.includes(role) && isBookmarkAvailable(b.id),
  );
  return (
    <section className="card profile-card">
      <h2>Настройки</h2>
      <div className="form">
        <h3>Оформление</h3>
        <p className="muted">Тёмная тема сохраняется в этом браузере.</p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={appTheme === "dark"}
            onChange={(e) => setAppTheme(e.target.checked ? "dark" : "light")}
          />
          Тёмная тема
        </label>
      </div>
      {(me?.role === "provider" || me?.role === "staff") && (
        <div className="form">
          <h3>Обучение</h3>
          <p className="muted">Краткий тур по разделам платформы для вашей организации.</p>
          <button type="button" className="ghost-btn" onClick={replayPlatformTour}>
            Показать обучение
          </button>
        </div>
      )}
      <div className="form">
        <h3>Закладки главного меню</h3>
        <p className="muted">
          Отмеченные пункты показываются сверху. Удерживайте строку и перетащите, чтобы изменить порядок.
        </p>
        <div className="bookmark-settings-list">
          {[
            ...subnavBookmarks
              .map((id) => bookmarkOptions.find((b) => b.id === id))
              .filter(Boolean),
            ...bookmarkOptions.filter((b) => !subnavBookmarks.includes(b.id)),
          ].map((b) => {
            const checked = subnavBookmarks.includes(b.id);
            return (
              <label
                key={b.id}
                className={["checkbox bookmark-settings-item", checked && "bookmark-settings-item--on"].filter(Boolean).join(" ")}
                draggable={checked}
                onDragStart={(e) => {
                  if (!checked) return;
                  e.dataTransfer.setData("text/plain", b.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (!checked) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromId = e.dataTransfer.getData("text/plain");
                  if (!fromId || fromId === b.id || !subnavBookmarks.includes(b.id)) return;
                  setSubnavBookmarks((prev) => {
                    const next = [...prev];
                    const from = next.indexOf(fromId);
                    const to = next.indexOf(b.id);
                    if (from < 0 || to < 0) return prev;
                    next.splice(from, 1);
                    next.splice(to, 0, fromId);
                    return next;
                  });
                }}
              >
                {checked ? <span className="bookmark-drag-handle" aria-hidden="true">⋮⋮</span> : null}
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSubnavBookmark(b.id)}
                />
                <span>{bookmarkLabel(b.id, role, me?.provider_sphere)}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setSubnavBookmarks(defaultSubnavBookmarks(role, me?.provider_sphere))}
        >
          Сбросить по умолчанию
        </button>
      </div>
      <form onSubmit={changePassword} className="form">
        <h3>{me?.has_usable_password === false ? "Задать пароль" : "Смена пароля"}</h3>
        {me?.has_usable_password !== false ? (
          <PasswordInput
            value={passwordForm.old_password}
            onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
            placeholder="Старый пароль"
            autoComplete="current-password"
          />
        ) : null}
        <PasswordInput
          value={passwordForm.new_password}
          onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
          placeholder="Новый пароль"
          autoComplete="new-password"
        />
        <PasswordInput
          value={passwordForm.new_password_confirm}
          onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })}
          placeholder="Повтори новый пароль"
          autoComplete="new-password"
        />
        <button type="submit">{me?.has_usable_password === false ? "Сохранить пароль" : "Сменить пароль"}</button>
        <p className="muted small">
          Не помните текущий пароль? Отправим ссылку на сброс{me?.email ? ` на ${me.email}` : ""}.
        </p>
        <button
          type="button"
          className="ghost-btn"
          disabled={passwordResetBusy || me?.is_demo}
          onClick={requestPasswordResetFromSettings}
        >
          {passwordResetBusy ? "Отправляем…" : "Сбросить через почту"}
        </button>
      </form>
      <form onSubmit={changeEmail} className="form">
        <h3>Смена почты</h3>
        <input type="email" value={emailForm.new_email} onChange={(e) => setEmailForm({ new_email: e.target.value })} placeholder="Новый email" />
        <button type="submit">Сменить email</button>
      </form>
      {!me?.email_verified && (
        <>
          <p className="status">Подтверди email для полноценной работы.</p>
          <button type="button" onClick={resendVerification}>Отправить письмо повторно</button>
          <p className="status">{resendStatus}</p>
        </>
      )}
      {me?.role === "client" || me?.role === "staff" ? (
        <form onSubmit={saveClientNotifyPrefs} className="form">
          <h3>Уведомления о записях</h3>
          <p className="muted small">
            {me?.role === "staff"
              ? "Push всегда; Telegram — если привяжете чат. Напоминания приходят по записям, где вы мастер, когда организация включила канал."
              : "Push всегда; SMS и мессенджеры — если организация включила каналы и указала ключи."}
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(clientNotifyForm.notify_booking_reminders)}
              onChange={(e) => setClientNotifyForm((p) => ({ ...p, notify_booking_reminders: e.target.checked }))}
            />
            Напоминания за 24 ч и 2 ч до визита
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(clientNotifyForm.notify_booking_status)}
              onChange={(e) => setClientNotifyForm((p) => ({ ...p, notify_booking_status: e.target.checked }))}
            />
            Статусы: подтверждение, отмена, услуга оказана
          </label>
          <button type="submit">Сохранить уведомления</button>
          <p className="status">{clientNotifyStatus}</p>
          <h4>Telegram</h4>
          <p className="muted small">
            Привяжите чат через бота платформы — напоминания придут в Telegram, если организация включила канал.
          </p>
          <div className="row-2">
            <button type="button" className="ghost-btn" onClick={loadTelegramLink}>
              Показать код / ссылку
            </button>
            {telegramLinkInfo?.linked ? (
              <button type="button" className="ghost-btn" onClick={unlinkTelegram}>
                Отвязать
              </button>
            ) : null}
          </div>
          {telegramLinkInfo ? (
            <div>
              <p
                className={`telegram-bind-status ${
                  telegramLinkInfo.linked ? "telegram-bind-status--ok" : "telegram-bind-status--bad"
                }`}
              >
                <span className="telegram-bind-mark" aria-hidden="true">
                  {telegramLinkInfo.linked ? "✓" : "✕"}
                </span>
                <span>
                  {telegramLinkInfo.linked ? "Привязан." : "Не привязан."} Код:{" "}
                  <code>{telegramLinkInfo.link_token}</code>
                </span>
              </p>
              {telegramLinkInfo.deep_link ? (
                <a href={telegramLinkInfo.deep_link} target="_blank" rel="noreferrer">
                  Открыть бота
                </a>
              ) : (
                <p className="muted small">{telegramLinkInfo.hint}</p>
              )}
            </div>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
