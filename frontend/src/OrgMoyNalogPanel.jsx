/** Подключение «Мой налог» для автовыдачи чеков самозанятым. */
import { useCallback, useEffect, useState } from "react";

const STATUS_LABEL = {
  issued: "Выбит",
  failed: "Ошибка",
  maybe: "Проверьте вручную",
  pending: "В процессе",
  none: "—",
  cancelled: "Аннулирован",
};

export default function OrgMoyNalogPanel({ authFetch, API_URL }) {
  const [status, setStatus] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [mode, setMode] = useState("sms"); // sms | password
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [inn, setInn] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const [stRes, rcRes] = await Promise.all([
        authFetch(`${API_URL}/moy-nalog/status/`),
        authFetch(`${API_URL}/moy-nalog/receipts/`),
      ]);
      if (stRes.ok) setStatus(await stRes.json());
      if (rcRes.ok) setReceipts(await rcRes.json());
    } catch {
      setMessage("Не удалось загрузить статус «Мой налог»");
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(next) {
    setBusy("enabled");
    setMessage("");
    try {
      const res = await authFetch(`${API_URL}/moy-nalog/status/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Ошибка");
      setStatus(data);
    } catch (e) {
      setMessage(e.message || "Ошибка");
    } finally {
      setBusy("");
    }
  }

  async function startSms(e) {
    e.preventDefault();
    setBusy("sms-start");
    setMessage("");
    try {
      const res = await authFetch(`${API_URL}/moy-nalog/connect/sms/start/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось отправить SMS");
      setChallengeToken(data.challenge_token || "");
      setMessage("Код отправлен в SMS. Введите его ниже.");
    } catch (err) {
      setMessage(err.message || "Ошибка");
    } finally {
      setBusy("");
    }
  }

  async function verifySms(e) {
    e.preventDefault();
    setBusy("sms-verify");
    setMessage("");
    try {
      const res = await authFetch(`${API_URL}/moy-nalog/connect/sms/verify/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: smsCode, challenge_token: challengeToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Неверный код");
      setStatus(data);
      setPassword("");
      setSmsCode("");
      setChallengeToken("");
      setMessage("«Мой налог» подключён. Чеки будут выбиваться при оплате.");
      load();
    } catch (err) {
      setMessage(err.message || "Ошибка");
    } finally {
      setBusy("");
    }
  }

  async function connectPassword(e) {
    e.preventDefault();
    setBusy("password");
    setMessage("");
    try {
      const res = await authFetch(`${API_URL}/moy-nalog/connect/password/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inn, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось войти");
      setStatus(data);
      setPassword("");
      setMessage("«Мой налог» подключён.");
      load();
    } catch (err) {
      setMessage(err.message || "Ошибка");
    } finally {
      setBusy("");
    }
  }

  async function disconnect() {
    if (!window.confirm("Отключить «Мой налог»? Авточеки прекратятся.")) return;
    setBusy("disconnect");
    try {
      const res = await authFetch(`${API_URL}/moy-nalog/disconnect/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setStatus(data);
      setMessage("Отключено.");
    } finally {
      setBusy("");
    }
  }

  async function retryReceipt(id) {
    setBusy(`retry-${id}`);
    setMessage("");
    try {
      const res = await authFetch(`${API_URL}/moy-nalog/receipts/${id}/retry/`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось повторить");
      setMessage(data.status === "issued" ? "Чек выбит." : data.error_message || "Обновлено");
      load();
    } catch (err) {
      setMessage(err.message || "Ошибка");
    } finally {
      setBusy("");
    }
  }

  const connected = Boolean(status?.connected);

  return (
    <section className="vm-panel" style={{ marginTop: 24 }}>
      <h3 className="vm-title">Мой налог (самозанятые)</h3>
      <p className="vm-subtitle">
        При оплате услуги Вместе автоматически зарегистрирует доход в «Мой налог» и выдаст чек.
        Подключение через API личного кабинета ФНС (неофициальный). Токены хранятся зашифрованно.
      </p>

      {connected ? (
        <div className="form" style={{ gap: 12 }}>
          <p>
            Подключено{status.inn ? `: ИНН ${status.inn}` : ""}
            {status.display_name ? ` · ${status.display_name}` : ""}
          </p>
          <label className="field-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={Boolean(status.enabled)}
              disabled={busy === "enabled"}
              onChange={(e) => toggleEnabled(e.target.checked)}
            />
            Автоматически выбивать чек при онлайн-оплате
          </label>
          {status.last_error ? <p className="muted small">Последняя ошибка: {status.last_error}</p> : null}
          <button type="button" className="vm-btn vm-btn--ghost" disabled={!!busy} onClick={disconnect}>
            Отключить
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button
              type="button"
              className={`vm-btn ${mode === "sms" ? "vm-btn--primary" : "vm-btn--ghost"}`}
              onClick={() => setMode("sms")}
            >
              По SMS
            </button>
            <button
              type="button"
              className={`vm-btn ${mode === "password" ? "vm-btn--primary" : "vm-btn--ghost"}`}
              onClick={() => setMode("password")}
            >
              ИНН и пароль
            </button>
          </div>

          {mode === "sms" ? (
            <form className="form" onSubmit={challengeToken ? verifySms : startSms}>
              <label className="field-label">
                Телефон в «Мой налог»
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="79XXXXXXXXX"
                  required
                />
              </label>
              {challengeToken ? (
                <label className="field-label">
                  Код из SMS
                  <input
                    type="text"
                    inputMode="numeric"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    required
                  />
                </label>
              ) : null}
              <button type="submit" className="vm-btn vm-btn--primary" disabled={!!busy}>
                {challengeToken ? "Подтвердить и подключить" : "Получить SMS-код"}
              </button>
            </form>
          ) : (
            <form className="form" onSubmit={connectPassword}>
              <label className="field-label">
                ИНН / логин ЛК ФЛ
                <input type="text" value={inn} onChange={(e) => setInn(e.target.value)} required autoComplete="username" />
              </label>
              <label className="field-label">
                Пароль
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>
              <p className="muted small">Пароль от личного кабинета налогоплательщика (lkfl), не от Госуслуг.</p>
              <button type="submit" className="vm-btn vm-btn--primary" disabled={!!busy}>
                Подключить
              </button>
            </form>
          )}
        </>
      )}

      {message ? <p className="muted small" style={{ marginTop: 12 }}>{message}</p> : null}

      {connected && receipts.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <h4>Последние чеки</h4>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {receipts.slice(0, 8).map((r) => (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--vm-border, #eee)",
                }}
              >
                <span>
                  {r.service_name || r.source} · {r.amount} ₽ · {STATUS_LABEL[r.status] || r.status}
                </span>
                {r.receipt_url ? (
                  <a href={r.receipt_url} target="_blank" rel="noreferrer">
                    Открыть
                  </a>
                ) : null}
                {r.status === "failed" ? (
                  <button
                    type="button"
                    className="vm-btn vm-btn--ghost"
                    disabled={!!busy}
                    onClick={() => retryReceipt(r.id)}
                  >
                    Повторить
                  </button>
                ) : null}
                {r.error_message ? <span className="muted small">{r.error_message}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
