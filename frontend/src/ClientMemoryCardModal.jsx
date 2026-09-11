import { useEffect, useState } from "react";
import { bookingStatusLabel } from "./bookingDisplay.jsx";
import { showToast } from "./toast.js";

const emptyTech = () => ({
  hair_color: "",
  lash_length: "",
  lash_curl: "",
  nail_shape: "",
  wax_brand: "",
  materials: "",
});

const emptyPersonal = () => ({
  music: "",
  drink: "",
  allergies: "",
  talk_topics: "",
});

const DEFAULT_FIELD_PREFS = {
  hair_color: true,
  lash_length: true,
  lash_curl: true,
  nail_shape: true,
  wax_brand: true,
  materials: true,
  technical_notes: true,
  music: true,
  drink: true,
  allergies: true,
  talk_topics: true,
  preferences_notes: true,
};

const TECH_PREF_OPTIONS = [
  { key: "hair_color", label: "Краска / формула" },
  { key: "lash_length", label: "Ресницы: длина" },
  { key: "lash_curl", label: "Ресницы: изгиб" },
  { key: "nail_shape", label: "Форма ногтей" },
  { key: "wax_brand", label: "Воск / материал" },
  { key: "materials", label: "Другие материалы" },
  { key: "technical_notes", label: "Заметки по технологии" },
];

const PERSONAL_PREF_OPTIONS = [
  { key: "music", label: "Музыка / атмосфера" },
  { key: "drink", label: "Напиток" },
  { key: "allergies", label: "Аллергии" },
  { key: "talk_topics", label: "О чём говорить" },
  { key: "preferences_notes", label: "Ещё заметки" },
];

function MemoryField({ label, children }) {
  return (
    <label className="client-memory-field">
      <span className="client-memory-field-label">{label}</span>
      {children}
    </label>
  );
}

/**
 * CRM «Помнить всё»: техкарта материалов + личные особенности клиента.
 */
export default function ClientMemoryCardModal({
  clientId,
  clientName,
  authFetch,
  API_URL,
  onClose,
  onOpenChat,
}) {
  const [tab, setTab] = useState("tech");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState(null);
  const [tech, setTech] = useState(emptyTech);
  const [personal, setPersonal] = useState(emptyPersonal);
  const [technicalNotes, setTechnicalNotes] = useState("");
  const [preferencesNotes, setPreferencesNotes] = useState("");
  const [fieldPrefs, setFieldPrefs] = useState(DEFAULT_FIELD_PREFS);
  const [isBlocked, setIsBlocked] = useState(false);
  const [noShowCount, setNoShowCount] = useState(0);
  const [acquisitionSource, setAcquisitionSource] = useState("");

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await authFetch(
          `${API_URL}/booking/client-cards/?client=${encodeURIComponent(clientId)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Не удалось загрузить карточку");
        if (cancelled) return;
        setCard(data);
        setTech({ ...emptyTech(), ...(data.tech || {}) });
        setPersonal({ ...emptyPersonal(), ...(data.personal || {}) });
        setTechnicalNotes(data.technical_notes || "");
        setPreferencesNotes(data.preferences_notes || "");
        setFieldPrefs({ ...DEFAULT_FIELD_PREFS, ...(data.field_prefs || {}) });
        setIsBlocked(Boolean(data.is_blocked));
        setNoShowCount(Number(data.no_show_count) || 0);
        setAcquisitionSource(data.acquisition_source || "");
      } catch (e) {
        if (!cancelled) showToast(e.message || "Ошибка загрузки", { tone: "error" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, clientId]);

  async function save(extra = {}) {
    setSaving(true);
    try {
      const res = await authFetch(
        `${API_URL}/booking/client-cards/?client=${encodeURIComponent(clientId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            tech,
            personal,
            technical_notes: technicalNotes,
            preferences_notes: preferencesNotes,
            field_prefs: fieldPrefs,
            is_blocked: isBlocked,
            no_show_count: noShowCount,
            acquisition_source: acquisitionSource,
            ...extra,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сохранить");
      setCard(data);
      if (data.field_prefs) setFieldPrefs({ ...DEFAULT_FIELD_PREFS, ...data.field_prefs });
      showToast("Карточка сохранена");
      return true;
    } catch (e) {
      showToast(e.message || "Ошибка сохранения", { tone: "error" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function togglePref(key) {
    const next = { ...fieldPrefs, [key]: !fieldPrefs[key] };
    setFieldPrefs(next);
    setSaving(true);
    try {
      const res = await authFetch(
        `${API_URL}/booking/client-cards/?client=${encodeURIComponent(clientId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ field_prefs: next }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сохранить настройки");
      if (data.field_prefs) setFieldPrefs({ ...DEFAULT_FIELD_PREFS, ...data.field_prefs });
    } catch (e) {
      setFieldPrefs(fieldPrefs);
      showToast(e.message || "Ошибка настроек", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const title = card?.client_name || clientName || `Клиент #${clientId}`;
  const show = (key) => fieldPrefs[key] !== false;

  return (
    <div className="modal-backdrop client-memory-backdrop" onClick={onClose}>
      <div
        className="modal-card client-memory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Карточка клиента"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="client-memory-close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
            <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.89 4.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
          </svg>
        </button>

        <header className="client-memory-head">
          <div className="client-memory-avatar" aria-hidden>
            {card?.client_avatar_url ? (
              <img src={card.client_avatar_url} alt="" />
            ) : (
              (card?.client_name || clientName || "?").trim().slice(0, 1).toUpperCase()
            )}
          </div>
          <div className="client-memory-head-copy">
            <p className="muted small">Помнить всё</p>
            <h2>{title}</h2>
            {card?.client_phone ? <p className="muted small">{card.client_phone}</p> : null}
          </div>
          <button
            type="button"
            className={`client-memory-settings-btn${settingsOpen ? " is-on" : ""}`}
            aria-label="Настройки полей"
            aria-expanded={settingsOpen}
            title="Какие поля показывать"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 14.3 2h-4.6a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.31 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.05.24.25.42.49.42h4.6c.24 0 .44-.18.49-.42l.36-2.54c.58-.23 1.12-.54 1.63-.94l2.39.96c.25.1.54 0 .68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z" />
            </svg>
          </button>
        </header>

        {settingsOpen ? (
          <div className="client-memory-settings">
            <p className="muted small">Отметьте поля, которые нужны в вашей работе.</p>
            <div className="client-memory-settings-grid">
              <div>
                <strong className="client-memory-settings-title">Техкарта</strong>
                {TECH_PREF_OPTIONS.map((o) => (
                  <label key={o.key} className="client-memory-check">
                    <input
                      type="checkbox"
                      checked={show(o.key)}
                      onChange={() => void togglePref(o.key)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              <div>
                <strong className="client-memory-settings-title">Личное</strong>
                {PERSONAL_PREF_OPTIONS.map((o) => (
                  <label key={o.key} className="client-memory-check">
                    <input
                      type="checkbox"
                      checked={show(o.key)}
                      onChange={() => void togglePref(o.key)}
                    />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="client-memory-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={tab === "tech" ? "is-active" : ""}
            onClick={() => setTab("tech")}
          >
            Техкарта
          </button>
          <button
            type="button"
            role="tab"
            className={tab === "personal" ? "is-active" : ""}
            onClick={() => setTab("personal")}
          >
            Личное
          </button>
          <button
            type="button"
            role="tab"
            className={tab === "visits" ? "is-active" : ""}
            onClick={() => setTab("visits")}
          >
            Визиты
          </button>
          <button
            type="button"
            role="tab"
            className={tab === "trust" ? "is-active" : ""}
            onClick={() => setTab("trust")}
          >
            Надёжность
          </button>
        </div>

        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : (
          <div className="client-memory-body">
            {tab === "tech" ? (
              <>
                <p className="muted small">
                  Материалы и формулы, чтобы в следующий раз повторить тот же результат.
                </p>
                {show("hair_color") ? (
                  <MemoryField label="Номер / формула краски">
                    <input
                      value={tech.hair_color}
                      onChange={(e) => setTech((t) => ({ ...t, hair_color: e.target.value }))}
                      placeholder="Напр. 7/1 + оксид 3%"
                    />
                  </MemoryField>
                ) : null}
                {show("lash_length") || show("lash_curl") ? (
                  <div className="client-memory-row">
                    {show("lash_length") ? (
                      <MemoryField label="Ресницы: длина">
                        <input
                          value={tech.lash_length}
                          onChange={(e) => setTech((t) => ({ ...t, lash_length: e.target.value }))}
                          placeholder="8–12 мм"
                        />
                      </MemoryField>
                    ) : null}
                    {show("lash_curl") ? (
                      <MemoryField label="Изгиб">
                        <input
                          value={tech.lash_curl}
                          onChange={(e) => setTech((t) => ({ ...t, lash_curl: e.target.value }))}
                          placeholder="C / D / L"
                        />
                      </MemoryField>
                    ) : null}
                  </div>
                ) : null}
                {show("nail_shape") || show("wax_brand") ? (
                  <div className="client-memory-row">
                    {show("nail_shape") ? (
                      <MemoryField label="Форма ногтей">
                        <input
                          value={tech.nail_shape}
                          onChange={(e) => setTech((t) => ({ ...t, nail_shape: e.target.value }))}
                          placeholder="миндаль, квадрат…"
                        />
                      </MemoryField>
                    ) : null}
                    {show("wax_brand") ? (
                      <MemoryField label="Марка воска / материал">
                        <input
                          value={tech.wax_brand}
                          onChange={(e) => setTech((t) => ({ ...t, wax_brand: e.target.value }))}
                        />
                      </MemoryField>
                    ) : null}
                  </div>
                ) : null}
                {show("materials") ? (
                  <MemoryField label="Другие материалы">
                    <input
                      value={tech.materials}
                      onChange={(e) => setTech((t) => ({ ...t, materials: e.target.value }))}
                      placeholder="Тоник, база, клей…"
                    />
                  </MemoryField>
                ) : null}
                {show("technical_notes") ? (
                  <MemoryField label="Заметки по технологии">
                    <textarea
                      rows={4}
                      value={technicalNotes}
                      onChange={(e) => setTechnicalNotes(e.target.value)}
                      placeholder="Время выдержки, схема пробора, особенности кожи…"
                    />
                  </MemoryField>
                ) : null}
                {!TECH_PREF_OPTIONS.some((o) => show(o.key)) ? (
                  <p className="muted small">В настройках не выбрано ни одного поля техкарты.</p>
                ) : null}
              </>
            ) : null}

            {tab === "personal" ? (
              <>
                <p className="muted small">
                  Мелочи, от которых клиент чувствует себя особенным — и возвращается.
                </p>
                {show("music") ? (
                  <MemoryField label="Музыка / атмосфера">
                    <input
                      value={personal.music}
                      onChange={(e) => setPersonal((p) => ({ ...p, music: e.target.value }))}
                      placeholder="Лоунж, без разговоров по телефону…"
                    />
                  </MemoryField>
                ) : null}
                {show("drink") ? (
                  <MemoryField label="Напиток">
                    <input
                      value={personal.drink}
                      onChange={(e) => setPersonal((p) => ({ ...p, drink: e.target.value }))}
                      placeholder="Кофе с молоком / чай без сахара"
                    />
                  </MemoryField>
                ) : null}
                {show("allergies") ? (
                  <MemoryField label="Аллергии / противопоказания">
                    <input
                      value={personal.allergies}
                      onChange={(e) => setPersonal((p) => ({ ...p, allergies: e.target.value }))}
                      placeholder="На латекс, аромат…"
                    />
                  </MemoryField>
                ) : null}
                {show("talk_topics") ? (
                  <MemoryField label="О чём говорить / спросить">
                    <textarea
                      rows={3}
                      value={personal.talk_topics}
                      onChange={(e) => setPersonal((p) => ({ ...p, talk_topics: e.target.value }))}
                      placeholder="Спросить, как прошёл отпуск; ребёнок в школе…"
                    />
                  </MemoryField>
                ) : null}
                {show("preferences_notes") ? (
                  <MemoryField label="Ещё заметки">
                    <textarea
                      rows={3}
                      value={preferencesNotes}
                      onChange={(e) => setPreferencesNotes(e.target.value)}
                      placeholder="Температура в кабинете, предпочитает тишину…"
                    />
                  </MemoryField>
                ) : null}
                {!PERSONAL_PREF_OPTIONS.some((o) => show(o.key)) ? (
                  <p className="muted small">В настройках не выбрано ни одного личного поля.</p>
                ) : null}
              </>
            ) : null}

            {tab === "visits" ? (
              <ul className="client-memory-visits">
                {(card?.recent_visits || []).map((v) => (
                  <li key={v.id}>
                    <strong>{v.service_name || `Запись #${v.id}`}</strong>
                    <span className="muted small">
                      {v.created_at ? new Date(v.created_at).toLocaleString("ru-RU") : ""} ·{" "}
                      {v.status_label || bookingStatusLabel(v.status) || v.status}
                    </span>
                    {v.comment ? <p className="small">{v.comment}</p> : null}
                  </li>
                ))}
                {!card?.recent_visits?.length ? <li className="muted">Пока нет визитов.</li> : null}
              </ul>
            ) : null}

            {tab === "trust" ? (
              <>
                <p className="muted small">
                  Защита от убытков: неявки и чёрный список блокируют онлайн-запись.
                </p>
                <MemoryField label="Откуда пришёл клиент">
                  <input
                    value={acquisitionSource}
                    onChange={(e) => setAcquisitionSource(e.target.value)}
                    placeholder="Рекомендация / Instagram / Реклама…"
                  />
                </MemoryField>
                <MemoryField label="Неявок без предупреждения">
                  <input
                    type="number"
                    min={0}
                    max={999}
                    value={noShowCount}
                    onChange={(e) => setNoShowCount(Number(e.target.value) || 0)}
                  />
                </MemoryField>
                <label className="client-memory-check">
                  <input
                    type="checkbox"
                    checked={isBlocked}
                    onChange={(e) => setIsBlocked(e.target.checked)}
                  />
                  <span>Чёрный список — запретить онлайн-запись</span>
                </label>
                {noShowCount >= 2 && !isBlocked ? (
                  <p className="muted small">
                    Рекомендация: после 2 неявок требуйте предоплату или добавьте в чёрный список.
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        )}

        <footer className="client-memory-footer">
          {onOpenChat ? (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                onOpenChat(clientId);
                onClose?.();
              }}
            >
              Чат
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="primary-btn" disabled={saving || loading} onClick={() => void save()}>
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </footer>
      </div>
    </div>
  );
}
