import BookingMessageField from "./BookingMessageField.jsx";

/** Шаблоны SMS/сообщений при подтверждении, отмене и завершении записи. */
export default function OrgBookingMessagesSection({
  messages,
  onChange,
  onSubmit,
  settingsHighlight,
}) {
  return (
    <>
      <h3 id="org-booking-messages">Сообщения при работе с записями</h3>
      <form
        onSubmit={onSubmit}
        className={["form booking-messages-form", settingsHighlight && "org-settings-highlight"]
          .filter(Boolean)
          .join(" ")}
      >
        <BookingMessageField
          id="org-msg-confirm"
          presetKey="confirm"
          label="Подтверждение записи"
          value={messages.confirm}
          onChange={(v) => onChange((p) => ({ ...p, confirm: v }))}
          highlighted={settingsHighlight === "confirm"}
        />
        <BookingMessageField
          id="org-msg-cancel"
          presetKey="cancel"
          label="Отмена записи"
          value={messages.cancel}
          onChange={(v) => onChange((p) => ({ ...p, cancel: v }))}
          highlighted={settingsHighlight === "cancel"}
        />
        <BookingMessageField
          id="org-msg-done"
          presetKey="done"
          label="Услуга оказана"
          value={messages.done}
          onChange={(v) => onChange((p) => ({ ...p, done: v }))}
          highlighted={settingsHighlight === "done"}
        />
        <button type="submit">Сохранить сообщения</button>
      </form>
      <aside className="booking-messages-hint" aria-labelledby="booking-messages-hint-title">
        <h4 id="booking-messages-hint-title">Как это работает</h4>
        <p>
          Перетащите метку <strong>«Дата и время записи»</strong> в поле сообщения или нажмите на неё под полем — в
          тексте она отобразится такой же кнопкой, а не кодом.
        </p>
        <p>
          Когда вы подтверждаете, отменяете или завершаете запись, метка автоматически заменяется на дату и время клиента,
          например <strong>17.05.2026 14:30</strong>.
        </p>
        <p className="muted small booking-messages-hint-example">
          Пример: «Ваша запись подтверждена на» + метка «Дата и время записи» + «. Ждём вас!»
        </p>
      </aside>
    </>
  );
}
