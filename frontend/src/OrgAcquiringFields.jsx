/** Поля настройки эквайринга и предоплаты при записи. */
export default function OrgAcquiringFields({ form, onChange, saveStatus, providerSphere }) {
  const setForm = (patch) => onChange((prev) => ({ ...prev, ...patch }));

  return (
    <>
      <label className="field-label" htmlFor="org-pay-provider">
        Эквайер
      </label>
      <select
        id="org-pay-provider"
        value={form.payment_provider}
        onChange={(e) => setForm({ payment_provider: e.target.value })}
      >
        <option value="yookassa">ЮKassa</option>
        <option value="tbank">Т‑Банк (Тинькофф)</option>
        <option value="cloudpayments">CloudPayments</option>
        <option value="robokassa">Robokassa</option>
      </select>
      <label className="field-label" htmlFor="org-prepay-mode">
        Режим предоплаты
      </label>
      <select
        id="org-prepay-mode"
        value={form.prepay_mode}
        onChange={(e) => setForm({ prepay_mode: e.target.value })}
      >
        <option value="off">Выключена</option>
        <option value="percent">Частичная (процент от стоимости)</option>
        <option value="full">Полная стоимость услуги</option>
      </select>
      {form.prepay_mode === "percent" ? (
        <label className="field-label" htmlFor="org-prepay-percent">
          Процент предоплаты
          <input
            id="org-prepay-percent"
            type="number"
            min="1"
            max="100"
            value={form.prepay_percent}
            onChange={(e) => setForm({ prepay_percent: e.target.value })}
          />
        </label>
      ) : null}
      {form.payment_provider === "yookassa" ? (
        <>
          <label className="field-label" htmlFor="org-yk-shop">
            ЮKassa Shop ID
          </label>
          <input
            id="org-yk-shop"
            type="text"
            autoComplete="off"
            value={form.yookassa_shop_id}
            onChange={(e) => setForm({ yookassa_shop_id: e.target.value })}
          />
          <label className="field-label" htmlFor="org-yk-secret">
            ЮKassa Secret Key
          </label>
          <input
            id="org-yk-secret"
            type="password"
            autoComplete="new-password"
            value={form.yookassa_secret_key}
            onChange={(e) => setForm({ yookassa_secret_key: e.target.value })}
            placeholder={form.has_yookassa ? "••••••••" : ""}
          />
          <p className="muted small">HTTP-уведомления payment.succeeded → /api/subscriptions/webhook/yookassa/</p>
        </>
      ) : null}
      {form.payment_provider === "tbank" ? (
        <>
          <label className="field-label">
            Terminal Key
            <input
              type="text"
              autoComplete="off"
              value={form.tbank_terminal_key}
              onChange={(e) => setForm({ tbank_terminal_key: e.target.value })}
            />
          </label>
          <label className="field-label">
            Password
            <input
              type="password"
              autoComplete="new-password"
              value={form.tbank_password}
              onChange={(e) => setForm({ tbank_password: e.target.value })}
              placeholder={form.has_tbank ? "••••••••" : ""}
            />
          </label>
          <p className="muted small">NotificationURL → /api/subscriptions/webhook/tbank/</p>
        </>
      ) : null}
      {form.payment_provider === "cloudpayments" ? (
        <>
          <label className="field-label">
            Public ID
            <input
              type="text"
              autoComplete="off"
              value={form.cloudpayments_public_id}
              onChange={(e) => setForm({ cloudpayments_public_id: e.target.value })}
            />
          </label>
          <label className="field-label">
            API Secret
            <input
              type="password"
              autoComplete="new-password"
              value={form.cloudpayments_api_secret}
              onChange={(e) => setForm({ cloudpayments_api_secret: e.target.value })}
              placeholder={form.has_cloudpayments ? "••••••••" : ""}
            />
          </label>
          <p className="muted small">Check/Pay уведомления → /api/subscriptions/webhook/cloudpayments/</p>
        </>
      ) : null}
      {form.payment_provider === "robokassa" ? (
        <>
          <label className="field-label">
            Merchant Login
            <input
              type="text"
              autoComplete="off"
              value={form.robokassa_merchant_login}
              onChange={(e) => setForm({ robokassa_merchant_login: e.target.value })}
            />
          </label>
          <label className="field-label">
            Пароль #1
            <input
              type="password"
              autoComplete="new-password"
              value={form.robokassa_password1}
              onChange={(e) => setForm({ robokassa_password1: e.target.value })}
              placeholder={form.has_robokassa ? "••••••••" : ""}
            />
          </label>
          <label className="field-label">
            Пароль #2
            <input
              type="password"
              autoComplete="new-password"
              value={form.robokassa_password2}
              onChange={(e) => setForm({ robokassa_password2: e.target.value })}
              placeholder={form.has_robokassa ? "••••••••" : ""}
            />
          </label>
          <p className="muted small">Result URL → /api/subscriptions/webhook/robokassa/</p>
        </>
      ) : null}
      {providerSphere === "cafe_restaurant" ? (
        <p className="muted small">
          Для кафе можно оставить поля пустыми, если ключи уже указаны в настройках зала — они подставятся автоматически.
        </p>
      ) : null}
      {form.prepay_mode !== "off" && !form.has_payment_keys ? (
        <p className="status">
          Предоплата включена, но ключи выбранного эквайера не указаны — клиент не сможет записаться, пока не заполните
          их.
        </p>
      ) : null}
      <button type="submit">Сохранить эквайринг</button>
      <p className="status">{saveStatus}</p>
    </>
  );
}
