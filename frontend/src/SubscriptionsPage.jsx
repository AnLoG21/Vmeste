import { useEffect, useState } from "react";

const STATUS_LABELS = {
  pending: "Ожидает оплаты",
  active: "Активна",
  expired: "Истекла",
  cancelled: "Отменена",
};

const emptyRequestForm = { name: "", email: "", phone: "", telegram: "", message: "" };

export default function SubscriptionsPage({ apiUrl, authFetch, me }) {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({
    ...emptyRequestForm,
    email: me?.email || "",
    name: me?.first_name ? `${me.last_name || ""} ${me.first_name}`.trim() : "",
  });
  const [requestStatus, setRequestStatus] = useState("");

  async function loadAll() {
    setLoading(true);
    const [plansRes, subsRes, payRes] = await Promise.all([
      fetch(`${apiUrl}/subscriptions/plans/`),
      authFetch(`${apiUrl}/subscriptions/mine/`),
      authFetch(`${apiUrl}/subscriptions/payments/`),
    ]);
    if (plansRes.ok) setPlans(await plansRes.json());
    if (subsRes.ok) setSubscriptions(await subsRes.json());
    if (payRes.ok) setPayments(await payRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submitRequest(e) {
    e.preventDefault();
    setRequestStatus("Отправляем...");
    const response = await fetch(`${apiUrl}/users/automation-request/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestForm),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setRequestStatus(data.detail || "Не удалось отправить заявку.");
      return;
    }
    setRequestStatus(data.detail || "Заявка отправлена!");
    setRequestForm({ ...emptyRequestForm, email: me?.email || "" });
    setShowRequestForm(false);
  }

  async function payPlan(plan) {
    if (Number(plan.price_monthly) <= 0) {
      setShowRequestForm(true);
      return;
    }
    setStatus("Создаём платёж...");
    const response = await authFetch(`${apiUrl}/subscriptions/pay/`, {
      method: "POST",
      body: JSON.stringify({ plan_id: plan.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.detail || "Ошибка оплаты.");
      return;
    }
    if (data.confirmation_url) {
      window.location.href = data.confirmation_url;
      return;
    }
    setStatus(data.detail || "Подписка активирована.");
    loadAll();
  }

  async function renewSubscription(sub) {
    setStatus("Продлеваем...");
    const response = await authFetch(`${apiUrl}/subscriptions/renew/`, {
      method: "POST",
      body: JSON.stringify({ subscription_id: sub.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.detail || "Не удалось продлить.");
      return;
    }
    if (data.confirmation_url) {
      window.location.href = data.confirmation_url;
      return;
    }
    setStatus(data.detail || "Подписка продлена.");
    loadAll();
  }

  async function toggleAutoRenew(sub) {
    const response = await authFetch(`${apiUrl}/subscriptions/auto-renew/`, {
      method: "POST",
      body: JSON.stringify({ subscription_id: sub.id, auto_renew: !sub.auto_renew }),
    });
    if (response.ok) loadAll();
  }

  async function cancelSubscription(sub, immediate = false) {
    const msg = immediate
      ? "Отключить подписку сразу? Доступ к тарифу прекратится немедленно."
      : "Отключить автопродление? Подписка останется активной до конца оплаченного периода.";
    if (!window.confirm(msg)) return;

    setStatus("Отключаем подписку...");
    const response = await authFetch(`${apiUrl}/subscriptions/cancel/`, {
      method: "POST",
      body: JSON.stringify({ subscription_id: sub.id, immediate }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.detail || "Не удалось отключить подписку.");
      return;
    }
    setStatus(data.detail || "Подписка отключена.");
    loadAll();
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <section className="card profile-card subscriptions-page">
        <p>Загрузка...</p>
      </section>
    );
  }

  const activeSub = subscriptions.find((s) => s.is_active_now);
  const pendingSub = subscriptions.find((s) => s.status === "pending");

  return (
    <section className="card profile-card subscriptions-page full-width">
      <h2>Подписки</h2>
      <p className="subscriptions-lead">
        Управляйте тарифом, оплачивайте и продлевайте подписку. Оплата проходит через ЮKassa.
      </p>

      {activeSub && (
        <div className="subscriptions-active">
          <h3>Текущая подписка</h3>
          <p>
            <strong>{activeSub.plan?.name}</strong> — активна до {formatDate(activeSub.period_end)}
          </p>
          {activeSub.cancel_at_period_end && (
            <p className="subscriptions-cancel-note">
              Автопродление отключено. После {formatDate(activeSub.period_end)} подписка не продлится.
            </p>
          )}
          {!activeSub.cancel_at_period_end && (
            <label className="subscriptions-auto-renew">
              <input
                type="checkbox"
                checked={activeSub.auto_renew}
                onChange={() => toggleAutoRenew(activeSub)}
              />
              Автопродление
            </label>
          )}
          <div className="subscriptions-active-actions">
            {!activeSub.cancel_at_period_end && (
              <button type="button" onClick={() => renewSubscription(activeSub)}>
                Продлить сейчас
              </button>
            )}
            <button
              type="button"
              className="ghost-btn subscriptions-cancel-btn"
              onClick={() => cancelSubscription(activeSub, !!activeSub.cancel_at_period_end)}
            >
              {activeSub.cancel_at_period_end ? "Отключить досрочно" : "Отключить подписку"}
            </button>
          </div>
        </div>
      )}

      {pendingSub && (
        <div className="subscriptions-active subscriptions-pending">
          <h3>Ожидает оплаты</h3>
          <p>
            <strong>{pendingSub.plan?.name}</strong> — оплата не завершена
          </p>
          <button
            type="button"
            className="ghost-btn subscriptions-cancel-btn"
            onClick={() => cancelSubscription(pendingSub)}
          >
            Отменить
          </button>
        </div>
      )}

      <h3>Тарифы</h3>
      <div className="subscriptions-plans">
        {plans.map((plan) => (
          <article key={plan.id} className="subscriptions-plan-card">
            <h4>{plan.name}</h4>
            <p className="subscriptions-plan-desc">{plan.description}</p>
            {Number(plan.price_monthly) > 0 ? (
              <p className="subscriptions-plan-price">
                {Number(plan.price_monthly).toLocaleString("ru-RU")} ₽ / мес
              </p>
            ) : (
              <p className="subscriptions-plan-price">По договорённости</p>
            )}
            <ul className="subscriptions-plan-features">
              {(plan.features || []).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <button
              type="button"
              className={Number(plan.price_monthly) <= 0 ? "ghost-btn" : ""}
              onClick={() => payPlan(plan)}
            >
              {Number(plan.price_monthly) <= 0 ? "Оставить заявку" : "Оплатить"}
            </button>
          </article>
        ))}
      </div>

      {subscriptions.length > 0 && (
        <>
          <h3>История подписок</h3>
          <ul className="subscriptions-history">
            {subscriptions.map((sub) => (
              <li key={sub.id}>
                {sub.plan?.name} — {STATUS_LABELS[sub.status] || sub.status}
                {sub.period_end && ` · до ${formatDate(sub.period_end)}`}
              </li>
            ))}
          </ul>
        </>
      )}

      {payments.length > 0 && (
        <>
          <h3>Платежи</h3>
          <ul className="subscriptions-history">
            {payments.map((p) => (
              <li key={p.id}>
                {p.plan_name}: {Number(p.amount).toLocaleString("ru-RU")} ₽ — {p.status}
                {p.paid_at && ` · ${formatDate(p.paid_at)}`}
              </li>
            ))}
          </ul>
        </>
      )}

      {showRequestForm && (
        <div className="subscriptions-request">
          <h3>Заявка на индивидуальную автоматизацию</h3>
          <form className="landing-request-form" onSubmit={submitRequest}>
            <input placeholder="Ваше имя *" value={requestForm.name} onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })} required />
            <input type="email" placeholder="Email *" value={requestForm.email} onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })} required />
            <input placeholder="Телефон" value={requestForm.phone} onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })} />
            <input placeholder="Telegram" value={requestForm.telegram} onChange={(e) => setRequestForm({ ...requestForm, telegram: e.target.value })} />
            <textarea placeholder="Опишите задачи" rows={4} value={requestForm.message} onChange={(e) => setRequestForm({ ...requestForm, message: e.target.value })} />
            <button type="submit">Отправить заявку</button>
            <button type="button" className="ghost-btn" onClick={() => setShowRequestForm(false)}>Отмена</button>
          </form>
          {requestStatus && <p className="status">{requestStatus}</p>}
        </div>
      )}

      {status && <p className="status">{status}</p>}
    </section>
  );
}
