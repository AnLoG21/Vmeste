import { useEffect, useState } from "react";

const STATUS_LABELS = {
  pending: "Ожидает оплаты",
  active: "Активна",
  expired: "Истекла",
  cancelled: "Отменена",
};

const PAYMENT_STATUS_LABELS = {
  pending: "Ожидает",
  succeeded: "Успешно",
  cancelled: "Отменён",
  refunded: "Возврат",
};

const SOURCE_LABELS = {
  paid: "Оплата",
  trial: "Пробный период",
  promo: "Промокод",
};

const emptyRequestForm = { name: "", email: "", phone: "", telegram: "", message: "" };

function isVoicePlan(plan) {
  return plan?.product_kind === "voice";
}

export default function SubscriptionsPage({ apiUrl, authFetch, me }) {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [trialUsed, setTrialUsed] = useState(false);
  const [payments, setPayments] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [promoModalPlan, setPromoModalPlan] = useState(null);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [requestForm, setRequestForm] = useState({
    ...emptyRequestForm,
    email: me?.email || "",
    name: me?.first_name ? `${me.last_name || ""} ${me.first_name}`.trim() : "",
  });
  const [requestStatus, setRequestStatus] = useState("");

  async function loadAll() {
    setLoading(true);
    const [plansRes, subsRes, payRes] = await Promise.all([
      authFetch(`${apiUrl}/subscriptions/plans/`),
      authFetch(`${apiUrl}/subscriptions/mine/`),
      authFetch(`${apiUrl}/subscriptions/payments/`),
    ]);
    if (plansRes.ok) setPlans(await plansRes.json());
    if (subsRes.ok) {
      const data = await subsRes.json();
      if (Array.isArray(data)) {
        setSubscriptions(data);
      } else {
        setSubscriptions(Array.isArray(data.subscriptions) ? data.subscriptions : []);
        setTrialUsed(Boolean(data.trial_used));
      }
    }
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

  async function activateTrial(plan) {
    setStatus("Подключаем бесплатный тариф...");
    const response = await authFetch(`${apiUrl}/subscriptions/trial/`, {
      method: "POST",
      body: JSON.stringify({ plan_id: plan.id }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.detail || "Не удалось активировать.");
      return;
    }
    setStatus(data.detail || "Бесплатный тариф подключён.");
    loadAll();
  }

  async function payPlan(plan) {
    if (!plan) return;
    setPromoModalPlan(null);
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
    setStatus(data.detail || (isVoicePlan(plan) ? "Тариф минут активирован." : "Подписка активирована."));
    loadAll();
  }

  function openPayFlow(plan) {
    if (plan.plan_type === "trial" || plan.plan_type === "free" || plan.slug === "starter") {
      activateTrial(plan);
      return;
    }
    if (Number(plan.price_monthly) <= 0 || plan.plan_type === "custom") {
      setShowRequestForm(true);
      return;
    }
    if (isVoicePlan(plan)) {
      payPlan(plan);
      return;
    }
    setPromoCode("");
    setPromoError("");
    setPromoModalPlan(plan);
  }

  async function applyPromoAndClose() {
    const code = promoCode.trim();
    if (!code) {
      setPromoError("Введите промокод.");
      return;
    }
    setPromoBusy(true);
    setPromoError("");
    const response = await authFetch(`${apiUrl}/subscriptions/promo/`, {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    const data = await response.json().catch(() => ({}));
    setPromoBusy(false);
    if (!response.ok) {
      setPromoError(data.detail || "Не удалось применить промокод.");
      return;
    }
    setPromoModalPlan(null);
    setStatus(data.detail || "Промокод применён.");
    loadAll();
  }

  async function renewSubscription(sub) {
    setStatus("Продлеваем...");
    setPromoCode("");
    setPromoError("");
    if (isVoicePlan(sub.plan)) {
      setStatus("");
      payPlan(sub.plan);
      return;
    }
    const plan = sub.plan?.plan_type === "trial"
      ? plans.find((p) => p.slug === "business") || sub.plan
      : sub.plan;
    if (plan && Number(plan.price_monthly) > 0) {
      setPromoModalPlan(plan);
      setStatus("");
      return;
    }
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
      ? "Отключить подписку сразу? Если оплата была сегодня (не пробный период и не промокод), деньги вернутся автоматически."
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
    if (!iso) return "бессрочно";
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function planActionLabel(plan, { currentVoicePlanId } = {}) {
    if (isVoicePlan(plan)) {
      if (currentVoicePlanId && plan.id === currentVoicePlanId) return "Текущий тариф";
      if (currentVoicePlanId) return "Сменить тариф";
      return `Купить ${plan.voice_minutes_monthly || ""} мин`.trim();
    }
    if (plan.plan_type === "trial" || plan.plan_type === "free" || plan.slug === "starter") return "Подключить бесплатно";
    if (Number(plan.price_monthly) <= 0 || plan.plan_type === "custom") return "Оставить заявку";
    return "Оплатить";
  }

  if (loading) {
    return (
      <section className="card profile-card subscriptions-page">
        <p>Загрузка...</p>
      </section>
    );
  }

  const liveSubs = subscriptions.filter((s) => s.is_active_now);
  const activePlatform = liveSubs.find((s) => !isVoicePlan(s.plan));
  const activeVoice = liveSubs.find((s) => isVoicePlan(s.plan));
  const pendingSubs = subscriptions.filter((s) => s.status === "pending");
  const platformPlans = plans.filter((p) => !isVoicePlan(p));
  const voicePlans = plans.filter((p) => isVoicePlan(p));
  const currentVoicePlanId = activeVoice?.plan?.id;

  function expiringSoon(sub) {
    if (!sub?.period_end) return false;
    const ms = new Date(sub.period_end) - Date.now();
    return ms > 0 && ms / (1000 * 60 * 60 * 24) <= 3;
  }

  function renderActiveBlock(sub, title) {
    if (!sub) return null;
    const voice = isVoicePlan(sub.plan);
    const minutes = sub.plan?.voice_minutes_monthly;
    return (
      <div className={`subscriptions-active${voice ? " subscriptions-active--voice" : ""}`}>
        <h3>{title}</h3>
        <p>
          <strong>{sub.plan?.name}</strong>
          {voice && minutes ? ` · ${minutes} мин / мес` : ""}
          {" — "}
          активна до {formatDate(sub.period_end)}
          {sub.source ? ` · ${SOURCE_LABELS[sub.source] || sub.source}` : ""}
          {sub.promo_code ? ` (${sub.promo_code})` : ""}
        </p>
        {sub.cancel_at_period_end && (
          <p className="subscriptions-cancel-note">
            Автопродление отключено. После {formatDate(sub.period_end)} подписка не продлится.
          </p>
        )}
        {sub.source === "paid" && !sub.cancel_at_period_end && (
          <label className="subscriptions-auto-renew">
            <input
              type="checkbox"
              checked={sub.auto_renew}
              onChange={() => toggleAutoRenew(sub)}
            />
            Автопродление
          </label>
        )}
        <div className="subscriptions-active-actions">
          {sub.source === "paid" && (
            <button type="button" onClick={() => renewSubscription(sub)}>
              Продлить сейчас
            </button>
          )}
          {!voice && (sub.source === "trial" || sub.source === "promo" || sub.cancel_at_period_end) && (
            <button type="button" onClick={() => renewSubscription(sub)}>
              Перейти на «Бизнес»
            </button>
          )}
          <button
            type="button"
            className="ghost-btn subscriptions-cancel-btn"
            onClick={() => cancelSubscription(sub, !!sub.cancel_at_period_end || sub.source !== "paid")}
          >
            {sub.cancel_at_period_end || sub.source !== "paid" ? "Отключить досрочно" : "Отключить подписку"}
          </button>
        </div>
      </div>
    );
  }

  function renderPlanCards(list, { voice = false } = {}) {
    return (
      <div className="subscriptions-plans">
        {list.map((plan) => {
          const isCurrent = voice && plan.id === currentVoicePlanId;
          return (
            <article
              key={plan.id}
              className={`subscriptions-plan-card${isCurrent ? " is-current" : ""}${voice ? " subscriptions-plan-card--voice" : ""}`}
            >
              <h4>
                {voice ? "" : plan.plan_type === "trial" || plan.slug === "starter" ? "🎁 " : ""}
                {!voice && plan.slug === "business" ? "💼 " : ""}
                {!voice && plan.plan_type === "custom" ? "🛠️ " : ""}
                {voice ? "🎙 " : ""}
                {plan.name}
              </h4>
              <p className="subscriptions-plan-desc">{plan.description}</p>
              {voice && plan.voice_minutes_monthly ? (
                <p className="subscriptions-plan-minutes">{plan.voice_minutes_monthly} минут / месяц</p>
              ) : null}
              {plan.plan_type === "trial" || plan.plan_type === "free" || plan.slug === "starter" ? (
                <p className="subscriptions-plan-price">Бесплатно</p>
              ) : Number(plan.price_monthly) > 0 ? (
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
                className={
                  isCurrent || (Number(plan.price_monthly) <= 0 && plan.plan_type !== "trial" && plan.plan_type !== "free")
                    ? "ghost-btn"
                    : ""
                }
                disabled={isCurrent}
                onClick={() => openPayFlow(plan)}
              >
                {planActionLabel(plan, { currentVoicePlanId })}
              </button>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <section className="card profile-card subscriptions-page full-width">
      <h2>Подписки</h2>
      <p className="subscriptions-lead">
        Управляйте тарифом платформы и минутами голосового ассистента. Оплата проходит через ЮKassa.
        Оплачивая, вы принимаете условия{" "}
        <a href="/offer" target="_blank" rel="noreferrer">
          публичной оферты
        </a>
        .
      </p>

      <div className="subscriptions-policy">
        <h3>Важно знать</h3>
        <ul>
          <li>
            <strong>Бесплатный</strong> — онлайн-запись, каталог, чаты и карта без ограничения по
            сроку.
          </li>
          <li>
            <strong>Бизнес</strong> — сотрудники, аналитика и приоритетная поддержка. Перед оплатой
            можно ввести промокод.
          </li>
          <li>
            <strong>Голосовой ассистент</strong> — отдельные тарифы по минутам SpeechKit. Можно купить,
            продлить или сменить пакет; при смене лимит обновляется сразу.
          </li>
          <li>
            Если отключить оплаченную подписку <strong>досрочно в тот же день</strong>, когда была
            оплата (не пробный период и не промокод), деньги возвращаются автоматически.
          </li>
        </ul>
      </div>

      {(expiringSoon(activePlatform) || expiringSoon(activeVoice)) && (
        <div className="subscriptions-reminder-banner" role="status">
          {expiringSoon(activePlatform)
            ? `Подписка «${activePlatform.plan?.name}» истекает ${formatDate(activePlatform.period_end)}. `
            : ""}
          {expiringSoon(activeVoice)
            ? `Тариф минут «${activeVoice.plan?.name}» истекает ${formatDate(activeVoice.period_end)}.`
            : ""}
        </div>
      )}

      {renderActiveBlock(activePlatform, "Текущая подписка")}
      {renderActiveBlock(activeVoice, "Тариф голосового ассистента")}

      {pendingSubs.map((pendingSub) => (
        <div key={pendingSub.id} className="subscriptions-active subscriptions-pending">
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
      ))}

      <h3>Тарифы платформы</h3>
      {trialUsed && (
        <p className="muted">Ранее активированный пробный период больше не используется — действует бессрочный бесплатный тариф.</p>
      )}
      {renderPlanCards(platformPlans)}

      {voicePlans.length > 0 && (
        <>
          <h3 id="voice-minutes">Минуты голосового ассистента</h3>
          <p className="subscriptions-lead subscriptions-voice-lead">
            Пакеты минут для SpeechKit. Цены и объём можно менять в админке. Без оплаченного тарифа
            действует демо-лимит 30 минут в месяц.
          </p>
          {renderPlanCards(voicePlans, { voice: true })}
        </>
      )}

      {subscriptions.length > 0 && (
        <>
          <h3>История подписок</h3>
          <ul className="subscriptions-history">
            {subscriptions.map((sub) => (
              <li key={sub.id}>
                {sub.plan?.name} — {STATUS_LABELS[sub.status] || sub.status}
                {sub.source ? ` · ${SOURCE_LABELS[sub.source] || sub.source}` : ""}
                {sub.period_end && ` · до ${formatDate(sub.period_end)}`}
                {sub.refunded_at ? " · возврат оформлен" : ""}
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
                {p.plan_name}: {Number(p.amount).toLocaleString("ru-RU")} ₽ — {p.status_label || PAYMENT_STATUS_LABELS[p.status] || p.status}
                {p.paid_at && ` · ${formatDate(p.paid_at)}`}
                {p.refunded_at && ` · возврат ${formatDate(p.refunded_at)}`}
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

      {promoModalPlan && (
        <div className="modal-backdrop" onClick={() => !promoBusy && setPromoModalPlan(null)}>
          <div className="modal-card subscriptions-promo-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Промокод</h3>
            <p className="muted">
              Есть промокод? Введите его и нажмите «Применить». Или пропустите и перейдите к оплате
              тарифа «{promoModalPlan.name}» за{" "}
              {Number(promoModalPlan.price_monthly).toLocaleString("ru-RU")} ₽.
            </p>
            <input
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                setPromoError("");
              }}
              placeholder="Промокод"
              autoFocus
              disabled={promoBusy}
            />
            {promoError ? <p className="status subscriptions-promo-error">{promoError}</p> : null}
            <div className="subscriptions-promo-actions">
              <button type="button" className="ghost-btn" disabled={promoBusy} onClick={() => payPlan(promoModalPlan)}>
                Пропустить и оплатить
              </button>
              <button type="button" disabled={promoBusy} onClick={applyPromoAndClose}>
                {promoBusy ? "Проверяем..." : "Применить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {status && <p className="status">{status}</p>}
    </section>
  );
}
