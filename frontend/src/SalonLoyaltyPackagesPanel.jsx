import { useEffect, useState } from "react";

/**
 * Provider panel: visit packages + loyalty settings.
 * Expects authFetch and API_URL from parent.
 */
export default function SalonLoyaltyPackagesPanel({ authFetch, API_URL, services = [] }) {
  const [packages, setPackages] = useState([]);
  const [loyalty, setLoyalty] = useState({
    enabled: false,
    points_per_visit: 1,
    points_per_100_rub: 0,
    rub_per_point: "1",
    welcome_bonus: 0,
  });
  const [form, setForm] = useState({
    name: "",
    visits_count: "5",
    price: "",
    validity_days: "90",
    service_ids: [],
  });
  const [sell, setSell] = useState({ package: "", client: "", note: "" });
  const [purchases, setPurchases] = useState([]);
  const [status, setStatus] = useState("");

  async function reload() {
    const [pRes, lRes, cRes] = await Promise.all([
      authFetch(`${API_URL}/booking/packages/`),
      authFetch(`${API_URL}/booking/loyalty/settings/`),
      authFetch(`${API_URL}/booking/client-packages/`),
    ]);
    if (pRes.ok) setPackages(await pRes.json());
    if (lRes.ok) setLoyalty(await lRes.json());
    if (cRes.ok) setPurchases(await cRes.json());
  }

  useEffect(() => {
    reload();
  }, []);

  async function saveLoyalty(e) {
    e.preventDefault();
    const res = await authFetch(`${API_URL}/booking/loyalty/settings/`, {
      method: "PATCH",
      body: JSON.stringify({
        enabled: Boolean(loyalty.enabled),
        points_per_visit: Number(loyalty.points_per_visit) || 0,
        points_per_100_rub: Number(loyalty.points_per_100_rub) || 0,
        rub_per_point: String(loyalty.rub_per_point || "1"),
        welcome_bonus: Number(loyalty.welcome_bonus) || 0,
      }),
    });
    setStatus(res.ok ? "Лояльность сохранена." : "Не удалось сохранить лояльность.");
    if (res.ok) setLoyalty(await res.json());
  }

  async function createPackage(e) {
    e.preventDefault();
    const res = await authFetch(`${API_URL}/booking/packages/`, {
      method: "POST",
      body: JSON.stringify({
        name: form.name.trim(),
        visits_count: Number(form.visits_count) || 1,
        price: String(form.price || "0"),
        validity_days: form.validity_days ? Number(form.validity_days) : null,
        service_ids: form.service_ids.map(Number),
        is_active: true,
      }),
    });
    if (!res.ok) {
      setStatus("Не удалось создать абонемент.");
      return;
    }
    setForm({ name: "", visits_count: "5", price: "", validity_days: "90", service_ids: [] });
    setStatus("Абонемент создан.");
    reload();
  }

  async function uploadCover(pkgId, file) {
    if (!file) return;
    const fd = new FormData();
    fd.append("cover_image", file);
    const res = await authFetch(`${API_URL}/booking/packages/${pkgId}/`, {
      method: "PATCH",
      body: fd,
    });
    setStatus(res.ok ? "Фото абонемента сохранено." : "Не удалось загрузить фото.");
    if (res.ok) reload();
  }

  async function sellPackage(e) {
    e.preventDefault();
    const res = await authFetch(`${API_URL}/booking/client-packages/`, {
      method: "POST",
      body: JSON.stringify({
        package: Number(sell.package),
        client: String(sell.client || "").trim(),
        note: sell.note,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatus(data.detail || "Не удалось выдать абонемент. Укажите логин клиента (как в чатах).");
      return;
    }
    setSell({ package: "", client: "", note: "" });
    setStatus("Абонемент выдан клиенту.");
    reload();
  }

  return (
    <section className="card salon-loyalty-panel">
      <h2>Абонементы и лояльность</h2>
      <p className="muted small">
        Пакеты визитов списываются при отметке «услуга оказана». Баллы начисляются за каждый завершённый визит.
        Абонементы клиент может купить в приложении (или вы выдаёте по логину).
      </p>

      <h3>Лояльность</h3>
      <form className="form" onSubmit={saveLoyalty}>
        <label className="loyalty-enable-row">
          <input
            type="checkbox"
            checked={Boolean(loyalty.enabled)}
            onChange={(e) => setLoyalty((p) => ({ ...p, enabled: e.target.checked }))}
          />
          <span>Включить баллы</span>
        </label>
        <label>
          Баллов за визит
          <input
            type="number"
            min="0"
            value={loyalty.points_per_visit}
            onChange={(e) => setLoyalty((p) => ({ ...p, points_per_visit: e.target.value }))}
          />
        </label>
        <label>
          Баллов за каждые 100 ₽
          <input
            type="number"
            min="0"
            value={loyalty.points_per_100_rub}
            onChange={(e) => setLoyalty((p) => ({ ...p, points_per_100_rub: e.target.value }))}
          />
        </label>
        <label>
          1 балл = ₽ скидки
          <input
            value={loyalty.rub_per_point}
            onChange={(e) => setLoyalty((p) => ({ ...p, rub_per_point: e.target.value }))}
          />
        </label>
        <button type="submit">Сохранить лояльность</button>
      </form>

      <h3>Абонементы</h3>
      <ul className="salon-package-list">
        {packages.filter((p) => p.is_active !== false).map((p) => (
          <li key={p.id} className="salon-package-row">
            <label className="salon-package-photo-btn" title="Фото абонемента">
              {p.cover_image_url ? (
                <img src={p.cover_image_url} alt="" />
              ) : (
                <span aria-hidden="true">📷</span>
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => uploadCover(p.id, e.target.files?.[0])}
              />
            </label>
            <div>
              <strong>{p.name}</strong> — {p.visits_count} виз. · {Number(p.price).toLocaleString("ru-RU")} ₽
              {p.validity_days ? ` · ${p.validity_days} дн.` : ""}
            </div>
          </li>
        ))}
        {packages.length === 0 ? <li className="muted">Пока нет пакетов.</li> : null}
      </ul>

      <form className="form" onSubmit={createPackage}>
        <input
          placeholder="Название (например, 5 стрижек)"
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          required
        />
        <div className="form-row-2">
          <input
            type="number"
            min="1"
            placeholder="Визитов"
            value={form.visits_count}
            onChange={(e) => setForm((p) => ({ ...p, visits_count: e.target.value }))}
            required
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Цена ₽"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
          />
        </div>
        <input
          type="number"
          min="1"
          placeholder="Срок действия, дней"
          value={form.validity_days}
          onChange={(e) => setForm((p) => ({ ...p, validity_days: e.target.value }))}
        />
        <p className="muted small">Услуги (пусто = любой визит):</p>
        <div className="service-options-pick">
          {services.slice(0, 40).map((s) => {
            const on = form.service_ids.map(Number).includes(Number(s.id));
            return (
              <button
                key={s.id}
                type="button"
                className={`service-option-chip${on ? " is-on" : ""}`}
                onClick={() =>
                  setForm((p) => {
                    const id = Number(s.id);
                    const cur = p.service_ids.map(Number);
                    return {
                      ...p,
                      service_ids: on ? cur.filter((x) => x !== id) : [...cur, id],
                    };
                  })
                }
              >
                {s.name}
              </button>
            );
          })}
        </div>
        <button type="submit">Создать абонемент</button>
      </form>

      <h3>Выдать клиенту</h3>
      <form className="form" onSubmit={sellPackage}>
        <select
          value={sell.package}
          onChange={(e) => setSell((p) => ({ ...p, package: e.target.value }))}
          required
        >
          <option value="">Пакет</option>
          {packages
            .filter((p) => p.is_active !== false)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <input
          placeholder="Логин клиента (как в чатах) или ID"
          value={sell.client}
          onChange={(e) => setSell((p) => ({ ...p, client: e.target.value }))}
          required
        />
        <input
          placeholder="Комментарий"
          value={sell.note}
          onChange={(e) => setSell((p) => ({ ...p, note: e.target.value }))}
        />
        <button type="submit">Выдать</button>
      </form>

      {purchases.length > 0 ? (
        <>
          <h3>Выданные</h3>
          <ul className="salon-package-list">
            {purchases.slice(0, 20).map((p) => (
              <li key={p.id}>
                {p.client_name || `клиент #${p.client}`}: {p.package_name} — осталось {p.visits_remaining}/
                {p.visits_total} ({p.status})
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <p className="status">{status}</p>
    </section>
  );
}
