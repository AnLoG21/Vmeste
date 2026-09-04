import { formatInAppNotificationText } from "./bookingDisplay.jsx";
import { reviewImageUrl } from "./chatHelpers.jsx";
import PasswordInput from "./PasswordInput.jsx";
import { phoneFieldProps } from "./phone.js";

/** Личный кабинет: профиль, уведомления, удаление аккаунта, карточка сотрудника. */
export default function ProfileCabinetPanel({
  chatActivity,
  fullName,
  me,
  acceptStaffInvite,
  rejectStaffInvite,
  markInAppNotificationsRead,
  setPendingInspectionId,
  setCurrentView,
  updateProfile,
  profileForm,
  setProfileForm,
  canManageOrgSettings,
  deleteMyAccount,
  deleteAccountForm,
  setDeleteAccountForm,
  deleteAccountBusy,
  deleteAccountStatus,
  resendVerification,
  resendStatus,
  orgStaff,
  uploadStaffCard,
  deleteStaffPortfolioPhoto,
  staffInviteStatus,
}) {
  return (
    <section className="card profile-card">
      <div className="profile-title-row">
        <h2 className="profile-title-h2">Личный кабинет</h2>
        {(chatActivity?.badge_count ?? 0) > 0 && (
          <span className="profile-title-badge" title="Есть уведомления">
            {chatActivity.badge_count > 99 ? "99+" : chatActivity.badge_count}
          </span>
        )}
      </div>
      <p>Вы вошли как: <strong>{fullName}</strong></p>
      {(me?.role === "client" || me?.role === "staff") && (chatActivity?.pending_staff_invites?.length ?? 0) > 0 && (
        <div className="chat-invites-banner">
          {chatActivity.pending_staff_invites.map((inv) => (
            <div key={inv.id} className="chat-invite-card">
              <p>
                Приглашение присоединиться к организации{" "}
                <strong>{inv.provider_user?.organization_name || inv.provider_user?.username || "—"}</strong>.
              </p>
              <div className="chat-invite-actions">
                <button type="button" className="invite-accept-btn" onClick={() => acceptStaffInvite(inv.id)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  Подтвердить
                </button>
                <button type="button" className="invite-reject-btn" onClick={() => rejectStaffInvite(inv.id)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {(chatActivity?.notifications?.length ?? 0) > 0 && (
        <div className="chat-notif-banner">
          {chatActivity.notifications.map((n) => (
            <div key={n.id} className="chat-notif-card">
              <p>{formatInAppNotificationText(n)}</p>
              {n.payload?.when ? <p className="muted small">{n.payload.when}</p> : null}
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  if (n.kind === "inspection" || n.payload?.view === "inspections") {
                    markInAppNotificationsRead([n.id]);
                    if (n.payload?.inspection_id) {
                      setPendingInspectionId(Number(n.payload.inspection_id));
                    }
                    setCurrentView("inspections");
                    return;
                  }
                  if (
                    n.kind === "cafe_new_order" ||
                    n.kind === "cafe_waiter_call" ||
                    n.payload?.view === "cafe_orders" ||
                    n.payload?.sphere === "cafe_restaurant"
                  ) {
                    markInAppNotificationsRead([n.id]);
                    setCurrentView("cafe_orders");
                    return;
                  }
                  markInAppNotificationsRead([n.id]);
                }}
              >
                {n.kind === "inspection" ||
                n.kind === "cafe_new_order" ||
                n.kind === "cafe_waiter_call"
                  ? "Открыть"
                  : "Понятно"}
              </button>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={updateProfile} className="form">
        <h3>Личная информация</h3>
        <input value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} placeholder="Фамилия" />
        <input value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} placeholder="Имя" />
        <input value={profileForm.patronymic} onChange={(e) => setProfileForm({ ...profileForm, patronymic: e.target.value })} placeholder="Отчество" />
        <input
          placeholder="Телефон"
          {...phoneFieldProps(profileForm.phone, (phone) => setProfileForm({ ...profileForm, phone }))}
        />
        <div className="profile-save-row">
          <button type="submit">Сохранить данные</button>
        </div>
      </form>
      <div className="row-2 profile-quick-nav">
        <button type="button" className="ghost-btn" onClick={() => setCurrentView("settings")}>Настройки</button>
        {me?.role !== "client" && (
          <button type="button" className="ghost-btn" onClick={() => setCurrentView("subscriptions")}>Подписки</button>
        )}
        {canManageOrgSettings && (
          <button type="button" className="ghost-btn" onClick={() => setCurrentView("organization")}>Организация</button>
        )}
      </div>
      <div className="profile-delete-block">
        <h3>Удаление аккаунта</h3>
        <p className="muted small">
          Аккаунт будет деактивирован, персональные данные обезличены. Для подтверждения введите
          {me?.has_usable_password === false ? " слово «удалить»." : " пароль и слово «удалить»."}
        </p>
        <form onSubmit={deleteMyAccount} className="form">
          {me?.has_usable_password !== false ? (
          <PasswordInput
            placeholder="Текущий пароль"
            value={deleteAccountForm.password}
            onChange={(e) => setDeleteAccountForm((p) => ({ ...p, password: e.target.value }))}
            autoComplete="current-password"
            required
          />
          ) : null}
          <input
            placeholder='Введите «удалить»'
            value={deleteAccountForm.confirm}
            onChange={(e) => setDeleteAccountForm((p) => ({ ...p, confirm: e.target.value }))}
            required
          />
          <button type="submit" className="danger-btn" disabled={deleteAccountBusy}>
            {deleteAccountBusy ? "Удаление…" : "Удалить аккаунт"}
          </button>
          {deleteAccountStatus ? <p className="status error">{deleteAccountStatus}</p> : null}
        </form>
      </div>
      {!me?.email_verified && (
        <>
          <p className="status">Подтверди email для полноценной работы.</p>
          <button type="button" onClick={resendVerification}>Отправить письмо повторно</button>
          <p className="status">{resendStatus}</p>
        </>
      )}
      {me?.role === "staff" && (() => {
        const myLink =
          orgStaff.find(
            (l) =>
              Number(l.staff) === Number(me.id) &&
              l.is_active &&
              l.invitation_status !== "pending" &&
              l.invitation_status !== "rejected",
          ) || null;
        if (!myLink) {
          return (
            <>
              <h3>Моя организация</h3>
              <p className="muted">Разделы «Записи» и «Чаты» — под оранжевой шапкой (доступ по правам, их настраивает исполнитель).</p>
            </>
          );
        }
        const avatarUrl = myLink.avatar_thumb_url || (myLink.avatar_image ? reviewImageUrl(myLink.avatar_image) : "");
        const portfolio = myLink.portfolio_photos || [];
        return (
          <div className="staff-self-card">
            <h3>Карточка сотрудника</h3>
            <p className="muted small">Эти данные видят клиенты в карточке организации.</p>
            <label className="muted small-label">Должность</label>
            <p className="staff-self-job">{(myLink.job_title || "").trim() || "Не указана (задаёт организация)"}</p>
            <label className="muted small-label">Кратко о сотруднике</label>
            <textarea
              rows={3}
              key={`bio-${myLink.id}`}
              defaultValue={myLink.bio || ""}
              placeholder="Коротко расскажите о себе и опыте"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (myLink.bio || "").trim()) {
                  void uploadStaffCard(myLink.id, { bio: v });
                }
              }}
            />
            <div className="staff-media-block">
              <div className="staff-media-row">
                <div className="staff-media-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" />
                  ) : (
                    <span aria-hidden>{String(fullName || "?").slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <label className="ghost-btn small staff-media-upload-btn" title="Загрузить фото">
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      void uploadStaffCard(myLink.id, { avatarFile: f });
                      e.target.value = "";
                    }}
                  />
                  1 фото профиля
                </label>
              </div>
              <div className="staff-media-portfolio">
                <label className="muted small-label">Портфолио</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    void uploadStaffCard(myLink.id, { portfolioFiles: files });
                    e.target.value = "";
                  }}
                />
                {portfolio.length > 0 && (
                  <div className="staff-self-portfolio-list">
                    {portfolio.map((ph) => (
                      <button
                        key={ph.id}
                        type="button"
                        className="staff-self-portfolio-chip"
                        title="Удалить фото"
                        onClick={() => void deleteStaffPortfolioPhoto(myLink.id, ph.id)}
                      >
                        <img src={reviewImageUrl(ph, "thumb")} alt="" loading="lazy" decoding="async" />
                        <span aria-hidden>×</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {staffInviteStatus ? <p className="status">{staffInviteStatus}</p> : null}
          </div>
        );
      })()}
    </section>
  );
}
