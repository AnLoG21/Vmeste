import BookingMessageField from "./BookingMessageField.jsx";
import OrgMessengerChannelsForm from "./OrgMessengerChannelsForm.jsx";

/** Напоминания, winback и каналы мессенджеров организации. */
export default function OrgMessagingRemindersSection({
  form,
  onChange,
  onSubmit,
  saveStatus,
  telegramLinkInfo,
  onLoadTelegramLink,
  onRefreshTelegramLink,
  onUnlinkTelegram,
}) {
  return (
    <>
      <h3>Напоминания и мессенджеры</h3>
      <p className="muted small">
        Напоминания за 24 ч и 2 ч до записи: клиентам и организации. При новой записи можно сразу отправить клиенту
        детали и ссылку на подтверждение визита.         Каналы — Telegram, MAX, WhatsApp (Green-API), SMS, Email.
        SMS: ключ платформы или свой SMS.ru api_id. Клиент может отключить напоминания в своих настройках. Для салона —
        отдельно «давно не был».
      </p>
      <form onSubmit={onSubmit} className="form">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.remind_clients)}
            onChange={(e) => onChange((p) => ({ ...p, remind_clients: e.target.checked }))}
          />
          Напоминания клиентам
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.remind_org)}
            onChange={(e) => onChange((p) => ({ ...p, remind_org: e.target.checked }))}
          />
          Напоминания организации (себе)
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.notify_org_on_new)}
            onChange={(e) => onChange((p) => ({ ...p, notify_org_on_new: e.target.checked }))}
          />
          Уведомлять о новой записи
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.notify_client_on_new)}
            onChange={(e) => onChange((p) => ({ ...p, notify_client_on_new: e.target.checked }))}
          />
          Сообщать клиенту о новой записи
        </label>
        {form.notify_client_on_new ? (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(form.send_client_confirm_link)}
                onChange={(e) => onChange((p) => ({ ...p, send_client_confirm_link: e.target.checked }))}
              />
              Ссылка на подтверждение визита
            </label>
            <BookingMessageField
              id="org-msg-client-new-booking"
              label="Текст клиенту о новой записи"
              value={form.client_new_booking_template || ""}
              onChange={(v) => onChange((p) => ({ ...p, client_new_booking_template: v }))}
              placeholder="Вы записаны в {org} на {service} — {date}. Подтвердите визит: {confirm_url}"
              tokens={["org", "service", "date", "confirm_url", "client"]}
            />
          </>
        ) : null}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(form.winback_enabled)}
            onChange={(e) => onChange((p) => ({ ...p, winback_enabled: e.target.checked }))}
          />
          Напоминать «давно не был»
        </label>
        {form.winback_enabled ? (
          <>
            <label className="field-label" htmlFor="org-winback-weeks">
              Через сколько недель без визита
            </label>
            <input
              id="org-winback-weeks"
              type="number"
              min="1"
              max="52"
              value={form.winback_weeks || 4}
              onChange={(e) => onChange((p) => ({ ...p, winback_weeks: e.target.value }))}
            />
            <BookingMessageField
              id="org-msg-winback"
              label="Текст «давно не был»"
              value={form.winback_template || ""}
              onChange={(v) => onChange((p) => ({ ...p, winback_template: v }))}
              placeholder="Давно не виделись в {org}! … {weeks} нед. назад."
              tokens={["org", "weeks", "client"]}
            />
          </>
        ) : null}
        {form.notify_org_on_new ? (
          <>
            <BookingMessageField
              id="org-msg-new-booking"
              label="Текст уведомления о новой записи"
              value={form.new_booking_template || ""}
              onChange={(v) => onChange((p) => ({ ...p, new_booking_template: v }))}
              placeholder="Новая запись в {org}: {service} — {date}."
              tokens={["org", "service", "date"]}
            />
            <button type="submit">Сохранить</button>
            <p className="status">{saveStatus}</p>
          </>
        ) : (
          <>
            <button type="submit">Сохранить напоминания</button>
            <p className="status">{saveStatus}</p>
          </>
        )}
        <OrgMessengerChannelsForm
          form={form}
          onChange={onChange}
          saveStatus={saveStatus}
          telegramLinkInfo={telegramLinkInfo}
          onLoadTelegramLink={onLoadTelegramLink}
          onRefreshTelegramLink={onRefreshTelegramLink}
          onUnlinkTelegram={onUnlinkTelegram}
        />
      </form>
    </>
  );
}
