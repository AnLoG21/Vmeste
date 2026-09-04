import { MailRuIcon, OkIcon, VkIcon, YandexIcon } from "./AuthSocialIcons.jsx";
import { API_URL } from "./config.js";
import { SITE_LEGAL } from "./legal/siteLegal.js";
import PasswordInput from "./PasswordInput.jsx";
import { phoneFieldProps } from "./phone.js";

/** Auth modal content (login / register / reset / onboarding). App wraps with createPortal(..., document.body). */
export default function AuthModal({
  needsOnboarding,
  needsCredentialsSetup,
  closeAuth,
  verifyEmailNotice,
  setVerifyEmailNotice,
  resendVerificationForEmail,
  resendStatus,
  setResendStatus,
  completeCredentialsSetup,
  credentialsForm,
  setCredentialsForm,
  credentialsBusy,
  authStatus,
  setAuthStatus,
  me,
  authMode,
  setAuthMode,
  confirmPasswordReset,
  resetForm,
  setResetForm,
  passwordResetBusy,
  requestPasswordResetFromLogin,
  loginForm,
  setLoginForm,
  onLogin,
  completeOnboarding,
  onSubmit,
  registerStep,
  setRegisterStep,
  form,
  setForm,
  logout,
  continueProviderRegistration,
  sphereOptions,
  onAddressInput,
  geocodeAddress,
  detectedCity,
  addressSuggestions,
  pickSuggestion,
  destroyRegMap,
  emptyRegisterForm,
  authProviders,
  telegramLoginHostRef,
  status,
}) {
  return (
    <div className="auth-modal-overlay" role="presentation">
      <div className="auth-modal" role="dialog" aria-modal="true">
        {needsOnboarding || needsCredentialsSetup ? null : (
        <button type="button" className="auth-modal-close" onClick={closeAuth} aria-label="Закрыть">×</button>
        )}
        {verifyEmailNotice ? (
          <div className="auth-verify-panel">
            <h2>Подтвердите email</h2>
            <p className="auth-verify-lead">{verifyEmailNotice.detail}</p>
            <p>
              Мы отправили письмо на{" "}
              <strong>{verifyEmailNotice.email}</strong>. Перейдите по ссылке в письме, затем
              войдите в аккаунт.
            </p>
            <p className="hint">Не видите письмо? Проверьте папку «Спам» или «Промоакции».</p>
            <div className="auth-verify-actions">
              <button type="button" onClick={() => resendVerificationForEmail(verifyEmailNotice.email)}>
                Отправить письмо ещё раз
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setVerifyEmailNotice(null);
                  setResendStatus("");
                }}
              >
                Перейти ко входу
              </button>
            </div>
            {resendStatus ? <p className="status">{resendStatus}</p> : null}
          </div>
        ) : needsCredentialsSetup ? (
          <>
            <h2>Логин и пароль</h2>
            <form onSubmit={completeCredentialsSetup} className="form">
              <p className="muted small">
                После входа через соцсеть задайте свой логин и пароль — ими можно будет входить
                рядом с VK, Яндекс или Telegram.
              </p>
              <input
                placeholder="Логин"
                value={credentialsForm.username}
                onChange={(e) => setCredentialsForm({ ...credentialsForm, username: e.target.value })}
                required
                minLength={3}
                autoComplete="username"
                autoFocus
              />
              <PasswordInput
                placeholder="Пароль"
                value={credentialsForm.password}
                onChange={(e) => setCredentialsForm({ ...credentialsForm, password: e.target.value })}
                required
                autoComplete="new-password"
              />
              <PasswordInput
                placeholder="Повторите пароль"
                value={credentialsForm.password_confirm}
                onChange={(e) => setCredentialsForm({ ...credentialsForm, password_confirm: e.target.value })}
                required
                autoComplete="new-password"
              />
              <button type="submit" disabled={credentialsBusy}>
                {credentialsBusy ? "Сохраняем…" : "Сохранить и продолжить"}
              </button>
              {authStatus ? <p className="status">{authStatus}</p> : null}
            </form>
          </>
        ) : (
          <>
        <h2>
          {needsOnboarding
            ? me?.role === "provider"
              ? "Данные организации"
              : "Завершите регистрацию"
            : authMode === "reset"
              ? "Новый пароль"
              : authMode === "forgot"
                ? "Сброс пароля"
                : authMode === "login"
                  ? "Вход"
                  : "Регистрация"}
        </h2>
        {authMode === "reset" ? (
          <form onSubmit={confirmPasswordReset} className="form">
            <p className="muted small">Придумайте новый пароль для входа во Вместе.</p>
            <PasswordInput
              placeholder="Новый пароль"
              value={resetForm.new_password}
              onChange={(e) => setResetForm({ ...resetForm, new_password: e.target.value })}
              required
              autoComplete="new-password"
            />
            <PasswordInput
              placeholder="Повторите новый пароль"
              value={resetForm.new_password_confirm}
              onChange={(e) => setResetForm({ ...resetForm, new_password_confirm: e.target.value })}
              required
              autoComplete="new-password"
            />
            <button type="submit" disabled={passwordResetBusy}>
              {passwordResetBusy ? "Сохраняем…" : "Сохранить пароль"}
            </button>
          </form>
        ) : authMode === "forgot" ? (
          <form onSubmit={requestPasswordResetFromLogin} className="form">
            <p className="muted small">Укажите почту аккаунта — пришлём ссылку для нового пароля.</p>
            <input
              type="email"
              placeholder="Email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              required
              autoComplete="email"
            />
            <button type="submit" disabled={passwordResetBusy}>
              {passwordResetBusy ? "Отправляем…" : "Выслать ссылку"}
            </button>
            <button type="button" className="ghost-btn" onClick={() => { setAuthMode("login"); setAuthStatus(""); }}>
              Назад ко входу
            </button>
          </form>
        ) : authMode === "login" ? (
          <form onSubmit={onLogin} className="form">
            <input placeholder="Логин" value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} required />
            <PasswordInput
              placeholder="Пароль"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              required
              autoComplete="current-password"
            />
            <button type="submit">Войти</button>
            <button type="button" className="ghost-btn" onClick={() => { setAuthMode("forgot"); setAuthStatus(""); }}>
              Не помню пароль
            </button>
          </form>
        ) : (
          <form onSubmit={needsOnboarding ? completeOnboarding : onSubmit} className="form">
            {registerStep === 1 && (
              <>
                {needsOnboarding ? (
                  <p className="muted small">VK и другие сервисы не подставляют все поля — укажите недостающие данные.</p>
                ) : (
                  <>
                <div className="auth-role-tabs" role="tablist" aria-label="Тип аккаунта">
                  {[
                    { key: "client", label: "Клиент" },
                    { key: "provider", label: "Для бизнеса" },
                    { key: "staff", label: "Сотрудник" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={form.role === tab.key}
                      className={["auth-role-tab", form.role === tab.key && "is-active"].filter(Boolean).join(" ")}
                      onClick={() => {
                        setForm({ ...form, role: tab.key });
                        if (tab.key !== "provider") setRegisterStep(1);
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="muted small auth-role-hint">
                  {form.role === "client"
                    ? "Базовая регистрация для записи к организациям."
                    : form.role === "provider"
                      ? "Кабинет организации: услуги, запись, эквайринг."
                      : "Вход сотрудника по приглашению организации."}
                </p>
                  </>
                )}
                <input placeholder="Фамилия" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                <input placeholder="Имя" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                <input placeholder="Отчество (при наличии)" value={form.patronymic} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} />
                {needsOnboarding ? null : (
                  <input placeholder="Логин" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
                )}
                <input
                  placeholder="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required={!needsOnboarding}
                  disabled={needsOnboarding && Boolean((me?.email || "").trim())}
                />
                <input
                  placeholder="Телефон"
                  {...phoneFieldProps(form.phone, (phone) => setForm({ ...form, phone }))}
                />
                {needsOnboarding ? (
                  <>
                    <button type="submit">Продолжить</button>
                    <button type="button" className="ghost-btn" onClick={logout}>Выйти</button>
                  </>
                ) : (
                  <>
                <PasswordInput
                  placeholder="Пароль"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="new-password"
                />
                <PasswordInput
                  placeholder="Повторите пароль"
                  value={form.password_confirm}
                  onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
                  required
                  autoComplete="new-password"
                />
                <label className="checkbox auth-consent-item">
                  <input
                    type="checkbox"
                    checked={Boolean(form.age_confirmed)}
                    onChange={(e) => setForm({ ...form, age_confirmed: e.target.checked })}
                    required
                  />
                  <span>Мне исполнилось 18 лет</span>
                </label>
                <label className="checkbox auth-consent-item">
                  <input
                    type="checkbox"
                    checked={Boolean(form.accept_offer)}
                    onChange={(e) => setForm({ ...form, accept_offer: e.target.checked })}
                    required
                  />
                  <span>
                    Принимаю{" "}
                    <a href="/offer" target="_blank" rel="noopener noreferrer">
                      публичную оферту
                    </a>{" "}
                    (версия {SITE_LEGAL.offerVersion})
                  </span>
                </label>
                <label className="checkbox auth-consent-item">
                  <input
                    type="checkbox"
                    checked={Boolean(form.accept_privacy)}
                    onChange={(e) => setForm({ ...form, accept_privacy: e.target.checked })}
                    required
                  />
                  <span>
                    Согласен(на) на обработку персональных данных согласно{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      политике конфиденциальности
                    </a>{" "}
                    (версия {SITE_LEGAL.privacyVersion})
                  </span>
                </label>
                {form.role === "provider" ? <button type="button" onClick={continueProviderRegistration}>Продолжить</button> : <button type="submit">Создать аккаунт</button>}
                  </>
                )}
              </>
            )}
            {registerStep === 2 && (needsOnboarding ? me?.role === "provider" : form.role === "provider") && (
              <>
                <p className="muted small auth-provider-disclaimer">
                  {needsOnboarding
                    ? "Аккаунт создан. Выберите сферу и заполните данные организации — без этого кабинет не откроется."
                    : "Платформа «Вместе» предоставляет только ПО для записи и не оказывает конечные услуги клиентам. Лицензии и разрешения — ответственность организации."}
                </p>
                {needsOnboarding ? (
                  <>
                    <input placeholder="Фамилия" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
                    <input placeholder="Имя" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
                    <input placeholder="Отчество (при наличии)" value={form.patronymic} onChange={(e) => setForm({ ...form, patronymic: e.target.value })} />
                    <input
                      placeholder="Телефон"
                      {...phoneFieldProps(form.phone, (phone) => setForm({ ...form, phone }))}
                    />
                  </>
                ) : null}
                <select value={form.provider_sphere} onChange={(e) => setForm({ ...form, provider_sphere: e.target.value })} required>
                  <option value="">Выбери сферу услуг</option>
                  {sphereOptions.map((s) => <option key={s.key} value={s.key}>{s.value}</option>)}
                </select>
                <input placeholder="Название организации" value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} required />
                {form.provider_sphere === "marketplaces" ? (
                  <p className="muted small">Для маркетплейсов адрес и карта не нужны.</p>
                ) : (
                  <>
                <input
                  placeholder="Адрес"
                  value={form.organization_address}
                  onChange={(e) => onAddressInput(e.target.value)}
                  onBlur={(e) => geocodeAddress(e.target.value)}
                  required
                />
                {detectedCity && <p className="hint">Город поиска: {detectedCity}</p>}
                {addressSuggestions.length > 0 && (
                  <div className="suggestions">
                    {addressSuggestions.map((item, idx) => (
                      <button
                        key={`${item.value}-${idx}`}
                        type="button"
                        className="suggestion-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickSuggestion(item)}
                      >
                        {item.value}
                      </button>
                    ))}
                  </div>
                )}
                <div id="reg-map" className="map-box" />
                <div className="address-details-grid">
                  <input placeholder="Подъезд" value={form.entrance} onChange={(e) => setForm({ ...form, entrance: e.target.value })} />
                  <input placeholder="Этаж" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                  <input placeholder="Квартира/офис" value={form.apartment} onChange={(e) => setForm({ ...form, apartment: e.target.value })} />
                  <input placeholder="Домофон" value={form.intercom} onChange={(e) => setForm({ ...form, intercom: e.target.value })} />
                </div>
                <input
                  placeholder="Доп. ориентир (необязательно)"
                  value={form.organization_address_details}
                  onChange={(e) => setForm({ ...form, organization_address_details: e.target.value })}
                />
                  </>
                )}
                <input
                  placeholder="Номер лицензии (если есть)"
                  value={form.provider_license_number}
                  onChange={(e) => setForm({ ...form, provider_license_number: e.target.value })}
                />
                <label className="checkbox auth-consent-item">
                  <input
                    type="checkbox"
                    checked={Boolean(form.confirm_provider_authority)}
                    onChange={(e) => setForm({ ...form, confirm_provider_authority: e.target.checked })}
                    required={!me?.provider_authority_confirmed}
                  />
                  <span>
                    Подтверждаю, что организация вправе оказывать размещаемые услуги и имеет необходимые
                    лицензии/разрешения, если они требуются законом
                  </span>
                </label>
                {needsOnboarding ? (
                  <button type="button" className="ghost-btn" onClick={logout}>Выйти</button>
                ) : (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    destroyRegMap();
                    setRegisterStep(1);
                  }}
                >
                  Назад
                </button>
                )}
                <button type="submit">{needsOnboarding ? "Сохранить и войти" : "Завершить регистрацию"}</button>
              </>
            )}
          </form>
        )}
        {(authMode === "login" || (authMode === "register" && form.role !== "staff")) && registerStep === 1 && !needsOnboarding && (
          <div className="auth-social">
            <p className="auth-social-label">
              {authMode === "register" ? "Зарегистрироваться через" : "Войти через"}
            </p>
            <div className="auth-social-row">
              <div className="auth-social-telegram" ref={telegramLoginHostRef} />
              {authProviders.yandex ? (
                <a className="auth-social-logo-btn" href={`${API_URL}/users/auth/yandex/${authMode === "register" && (form.role === "client" || form.role === "provider") ? `?role=${encodeURIComponent(form.role)}` : ""}`} title="Яндекс">
                  <YandexIcon />
                </a>
              ) : null}
              {authProviders.vk ? (
                <a className="auth-social-vkid" href={`${API_URL}/users/auth/vk/${authMode === "register" && (form.role === "client" || form.role === "provider") ? `?role=${encodeURIComponent(form.role)}` : ""}`} title="ВКонтакте, Одноклассники и Mail">
                  <span className="auth-social-logo-btn auth-social-vkid-vk">
                    <VkIcon />
                  </span>
                  <span className="auth-social-logo-btn">
                    <OkIcon />
                  </span>
                  <span className="auth-social-logo-btn">
                    <MailRuIcon />
                  </span>
                </a>
              ) : null}
            </div>
            <p className="muted small">
              {authProviders.yandex || authProviders.vk
                ? "VK ID — одна кнопка: ВКонтакте, Одноклассники и Mail. Google в РФ без обхода ограничений недоступен как основной вход."
                : "Сейчас работает Telegram. Яндекс ID и VK ID появятся после настройки на сервере. Google в РФ без обхода ограничений недоступен как основной вход."}
            </p>
          </div>
        )}
        {needsOnboarding ? null : authMode === "login" || authMode === "register" ? (
          <>
            <p className="auth-switch-text">{authMode === "login" ? "Нет аккаунта?" : "Уже есть аккаунт?"}</p>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                const next = authMode === "login" ? "register" : "login";
                setRegisterStep(1);
                setForm({ ...emptyRegisterForm });
                setAuthMode(next);
              }}
            >
              {authMode === "login" ? "Регистрация" : "Войти"}
            </button>
          </>
        ) : null}
        <p className="status">{authMode === "login" ? authStatus : authStatus || status}</p>
          </>
        )}
      </div>
    </div>
  );
}
