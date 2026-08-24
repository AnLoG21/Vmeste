import { useCallback, useEffect, useState } from "react";

/**
 * Клиент: баллы лояльности и абонементы по организациям.
 */
export default function ClientLoyaltyPage({ authFetch, API_URL }) {
  const [accounts, setAccounts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [offerPackages, setOfferPackages] = useState([]);
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    const [aRes, pRes] = await Promise.all([
      authFetch(`${API_URL}/booking/loyalty/accounts/`),
      authFetch(`${API_URL}/booking/client-packages/`),
    ]);
    if (aRes.ok) {
      const data = await aRes.json();
      setAccounts(Array.isArray(data) ? data : []);
    } else {
      setAccounts([]);
    }
    if (pRes.ok) {
      const data = await pRes.json();
      setPackages(Array.isArray(data) ? data : []);
    }
  }, [authFetch, API_URL]);

  useEffect(() => {
    load();
  }, [load]);

  async function openProvider(providerId, providerName) {
    setSelectedProvider({ id: providerId, name: providerName });
    setStatus("");
    const [balRes, packRes] = await Promise.all([
      authFetch(`${API_URL}/booking/loyalty/me/?provider=${providerId}`),
      authFetch(`${API_URL}/booking/packages/?provider=${providerId}`),
    ]);
    if (balRes.ok) {
      const bal = await balRes.json();
      setAccounts((prev) => {
        const rest = prev.filter((a) => Number(a.provider) !== Number(providerId));
        return [...rest, { ...bal, provider: providerId, provider_name: providerName }];
      });
    }
    if (packRes.ok) {
      const list = await packRes.json();
      setOfferPackages(Array.isArray(list) ? list.filter((p) => p.is_active !== false) : []);
    } else setOfferPackages([]);
  }

  async function buyPackage(pkgId) {
    const res = await authFetch(`${API_URL}/booking/packages/${pkgId}/purchase/`, {
      method: "POST",
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.detail || "Не удалось оформить абонемент. Оплата у администратора / в салоне.");
      return;
    }
    setStatus("Абонемент оформлен — покажите его при визите.");
    load();
  }

  const balance = selectedProvider
    ? accounts.find((a) => Number(a.provider) === Number(selectedProvider.id))
    : null;
  const myPkgs = selectedProvider
    ? packages.filter((p) => Number(p.provider) === Number(selectedProvider.id))
    : [];

  if (selectedProvider) {
    return (
      <section className="card full-width client-loyalty-page">
        <button type="button" className="ghost-btn" onClick={() => setSelectedProvider(null)}>
          ← Все программы
        </button>
        <h2>{selectedProvider.name || "Организация"}</h2>
        <p>
          Баллы: <strong>{Number(balance?.balance || 0).toLocaleString("ru-RU")}</strong>
          {" · "}
          уровень:{" "}
          <strong>
            {balance?.level_label ||
              (Number(balance?.balance || 0) >= 500
                ? "Платина"
                : Number(balance?.balance || 0) >= 200
                  ? "Золото"
                  : Number(balance?.balance || 0) >= 50
                    ? "Серебро"
                    : "Старт")}
          </strong>
          {balance?.enabled === false ? <span className="muted"> (программа выключена)</span> : null}
        </p>
        {balance?.rub_per_point ? (
          <p className="muted small">1 балл ≈ {balance.rub_per_point} ₽ скидки при записи</p>
        ) : null}

        <h3>Мои абонементы</h3>
        {myPkgs.length === 0 ? <p className="muted">Пока нет активных абонементов.</p> : null}
        <ul className="salon-package-list">
          {myPkgs.map((p) => (
            <li key={p.id}>
              <strong>{p.package_name}</strong> — осталось {p.visits_remaining}/{p.visits_total} ({p.status})
            </li>
          ))}
        </ul>

        <h3>Купить абонемент</h3>
        <div className="loyalty-packages-scroll">
          {offerPackages.map((p) => (
            <article key={p.id} className="loyalty-package-card">
              {p.cover_image_url ? (
                <img src={p.cover_image_url} alt="" className="loyalty-package-cover" />
              ) : (
                <div className="loyalty-package-cover loyalty-package-cover--empty" />
              )}
              <strong>{p.name}</strong>
              <p className="muted small">
                {p.visits_count} виз. · {Number(p.price).toLocaleString("ru-RU")} ₽
                {p.validity_days ? ` · ${p.validity_days} дн.` : ""}
              </p>
              {p.description ? <p className="small">{p.description}</p> : null}
              <button type="button" onClick={() => buyPackage(p.id)}>
                Купить
              </button>
            </article>
          ))}
          {offerPackages.length === 0 ? <p className="muted">Нет предложений для покупки.</p> : null}
        </div>
        {status ? <p className="status">{status}</p> : null}
      </section>
    );
  }

  const byProvider = {};
  for (const a of accounts) {
    byProvider[a.provider] = a;
  }
  for (const p of packages) {
    if (!byProvider[p.provider]) {
      byProvider[p.provider] = {
        provider: p.provider,
        provider_name: p.provider_name || `Организация #${p.provider}`,
        balance: 0,
      };
    }
  }

  return (
    <section className="card full-width client-loyalty-page">
      <h2>Лояльность и абонементы</h2>
      <p className="muted small">Баллы и пакеты визитов по организациям, где вы были клиентом.</p>
      <ul className="client-cafe-order-list">
        {Object.values(byProvider).map((a) => (
          <li key={a.provider}>
            <button
              type="button"
              className="client-cafe-order-row"
              onClick={() => openProvider(a.provider, a.provider_name || a.organization_name)}
            >
              <strong>{a.provider_name || a.organization_name || `Организация #${a.provider}`}</strong>
              <span>{Number(a.balance || 0).toLocaleString("ru-RU")} баллов</span>
            </button>
          </li>
        ))}
      </ul>
      {Object.keys(byProvider).length === 0 ? (
        <p className="muted">Пока нет баллов — они появятся после визитов в салоны с программой лояльности.</p>
      ) : null}
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}
