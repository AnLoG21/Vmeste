import { useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [card, setCard] = useState(null);
  const [tech, setTech] = useState(emptyTech);
  const [personal, setPersonal] = useState(emptyPersonal);
  const [technicalNotes, setTechnicalNotes] = useState("");
  const [preferencesNotes, setPreferencesNotes] = useState("");

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

  async function save() {
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
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сохранить");
      setCard(data);
      showToast("Карточка сохранена");
    } catch (e) {
      showToast(e.message || "Ошибка сохранения", { tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const title = card?.client_name || clientName || `Клиент #${clientId}`;

  return (
    <div className="modal-backdrop client-memory-backdrop" onClick={onClose}>
      <div
        className="modal-card client-memory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Карточка клиента"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="client-memory-head">
          <div>
            <p className="muted small">Помнить всё</p>
            <h2>{title}</h2>
            {card?.client_phone ? <p className="muted small">{card.client_phone}</p> : null}
          </div>
          <button type="button" className="ghost-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </header>

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
                <label className="field">
                  <span>Номер / формула краски</span>
                  <input
                    value={tech.hair_color}
                    onChange={(e) => setTech((t) => ({ ...t, hair_color: e.target.value }))}
                    placeholder="Напр. 7/1 + оксид 3%"
                  />
                </label>
                <div className="form-row-2">
                  <label className="field">
                    <span>Ресницы: длина</span>
                    <input
                      value={tech.lash_length}
                      onChange={(e) => setTech((t) => ({ ...t, lash_length: e.target.value }))}
                      placeholder="8–12 мм"
                    />
                  </label>
                  <label className="field">
                    <span>Изгиб</span>
                    <input
                      value={tech.lash_curl}
                      onChange={(e) => setTech((t) => ({ ...t, lash_curl: e.target.value }))}
                      placeholder="C / D / L"
                    />
                  </label>
                </div>
                <div className="form-row-2">
                  <label className="field">
                    <span>Форма ногтей</span>
                    <input
                      value={tech.nail_shape}
                      onChange={(e) => setTech((t) => ({ ...t, nail_shape: e.target.value }))}
                      placeholder="миндаль, квадрат…"
                    />
                  </label>
                  <label className="field">
                    <span>Марка воска / материал</span>
                    <input
                      value={tech.wax_brand}
                      onChange={(e) => setTech((t) => ({ ...t, wax_brand: e.target.value }))}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Другие материалы</span>
                  <input
                    value={tech.materials}
                    onChange={(e) => setTech((t) => ({ ...t, materials: e.target.value }))}
                    placeholder="Тоник, база, клей…"
                  />
                </label>
                <label className="field">
                  <span>Заметки по технологии</span>
                  <textarea
                    rows={4}
                    value={technicalNotes}
                    onChange={(e) => setTechnicalNotes(e.target.value)}
                    placeholder="Время выдержки, схема пробора, особенности кожи…"
                  />
                </label>
              </>
            ) : null}

            {tab === "personal" ? (
              <>
                <p className="muted small">
                  Мелочи, от которых клиент чувствует себя особенным — и возвращается.
                </p>
                <label className="field">
                  <span>Музыка / атмосфера</span>
                  <input
                    value={personal.music}
                    onChange={(e) => setPersonal((p) => ({ ...p, music: e.target.value }))}
                    placeholder="Лоунж, без разговоров по телефону…"
                  />
                </label>
                <label className="field">
                  <span>Напиток</span>
                  <input
                    value={personal.drink}
                    onChange={(e) => setPersonal((p) => ({ ...p, drink: e.target.value }))}
                    placeholder="Кофе с молоком / чай без сахара"
                  />
                </label>
                <label className="field">
                  <span>Аллергии / противопоказания</span>
                  <input
                    value={personal.allergies}
                    onChange={(e) => setPersonal((p) => ({ ...p, allergies: e.target.value }))}
                    placeholder="На латекс, аромат…"
                  />
                </label>
                <label className="field">
                  <span>О чём говорить / спросить</span>
                    <textarea
                    rows={3}
                    value={personal.talk_topics}
                    onChange={(e) => setPersonal((p) => ({ ...p, talk_topics: e.target.value }))}
                    placeholder="Спросить, как прошёл отпуск; ребёнок в школе…"
                  />
                </label>
                <label className="field">
                  <span>Ещё заметки</span>
                  <textarea
                    rows={3}
                    value={preferencesNotes}
                    onChange={(e) => setPreferencesNotes(e.target.value)}
                    placeholder="Температура в кабинете, предпочитает тишину…"
                  />
                </label>
              </>
            ) : null}

            {tab === "visits" ? (
              <ul className="client-memory-visits">
                {(card?.recent_visits || []).map((v) => (
                  <li key={v.id}>
                    <strong>{v.service_name || `Запись #${v.id}`}</strong>
                    <span className="muted small">
                      {v.created_at ? new Date(v.created_at).toLocaleString("ru-RU") : ""} · {v.status}
                    </span>
                    {v.comment ? <p className="small">{v.comment}</p> : null}
                  </li>
                ))}
                {!card?.recent_visits?.length ? <li className="muted">Пока нет визитов.</li> : null}
              </ul>
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
