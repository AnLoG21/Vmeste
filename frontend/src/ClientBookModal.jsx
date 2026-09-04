import { JoinWaitlistButton } from "./WaitlistPanel.jsx";
import ServicePhotoCarousel from "./ServicePhotoCarousel.jsx";
import MiniDatePicker from "./MiniDatePicker.jsx";
import { formatStaffFullName } from "./chatHelpers.jsx";
import { bookingPrepayHint } from "./bookingDisplay.jsx";
import {
  formatTimeHm,
  clientWindowKey,
  groupClientWindowsByStaff,
} from "./bookingCalendarUtils.jsx";

/** Client booking overlay modal. App wraps with createPortal(..., document.body). */
export default function ClientBookModal({
  setClientBookModalOpen,
  mapOrgPopup,
  mapOrgProfile,
  createClientBooking,
  bookProviderStaff,
  providerServices,
  clientBookingForm,
  setClientBookingForm,
  openOrgPhotoLightbox,
  bookAvailableDates,
  clientBookWindows,
  authFetch,
  API_URL,
  bookClientPackages,
  bookLoyaltyInfo,
  clientStatus,
}) {
  const staffOptions = bookProviderStaff || [];
  const bookableServices = (() => {
    if (clientBookingForm.staffId === "any") return providerServices;
    const link = staffOptions.find(
      (l) => String(l.staff) === String(clientBookingForm.staffId),
    );
    if (!link) return providerServices;
    const svcIds = (link.assigned_service_ids || []).map(Number);
    const catIds = (link.assigned_category_ids || []).map(Number);
    if (!svcIds.length && !catIds.length) return providerServices;
    return providerServices.filter(
      (s) =>
        svcIds.includes(Number(s.id)) ||
        (s.category && catIds.includes(Number(s.category))),
    );
  })();

  const selectedService = providerServices.find(
    (s) => String(s.id) === String(clientBookingForm.serviceId),
  );
  const serviceOptions = (selectedService?.options || []).filter((o) => o.is_active !== false);
  const gallery = selectedService?.gallery || [];

  return (
    <div className="modal-backdrop modal-backdrop--app-overlay" onClick={() => setClientBookModalOpen(false)}>
      <div className="modal-card client-book-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="client-book-overlay-head">
          <h3>Запись{mapOrgPopup?.organization_name ? ` · ${mapOrgPopup.organization_name}` : ""}</h3>
          <button
            type="button"
            className="modal-close-btn"
            aria-label="Закрыть"
            onClick={() => setClientBookModalOpen(false)}
          >
            ×
          </button>
        </div>
        {mapOrgProfile?.phones?.length > 0 && (
          <div className="client-book-phones">
            {mapOrgProfile.phones.map((ph) => (
              <a key={ph} href={`tel:${ph.replace(/[^\d+]/g, "")}`}>
                {ph}
              </a>
            ))}
          </div>
        )}
        {bookingPrepayHint(mapOrgProfile?.prepay) ? (
          <p className="muted small">{bookingPrepayHint(mapOrgProfile.prepay)}</p>
        ) : null}
        <form onSubmit={createClientBooking} className="form">
          <p className="field-label">Мастер</p>
          <div className="client-book-staff-pick">
            <button
              type="button"
              className={`client-book-staff-chip${clientBookingForm.staffId === "any" ? " is-on" : ""}`}
              onClick={() =>
                setClientBookingForm((p) => ({
                  ...p,
                  staffId: "any",
                  serviceId: "",
                  optionIds: [],
                  windowKey: "",
                }))
              }
            >
              Любой
            </button>
            {staffOptions.map((link) => {
              const label =
                (link.display_name || "").trim() ||
                formatStaffFullName(link.staff_user) ||
                link.staff_username ||
                "Мастер";
              const on = String(clientBookingForm.staffId) === String(link.staff);
              return (
                <button
                  key={link.id}
                  type="button"
                  className={`client-book-staff-chip${on ? " is-on" : ""}`}
                  onClick={() =>
                    setClientBookingForm((p) => ({
                      ...p,
                      staffId: String(link.staff),
                      serviceId: "",
                      optionIds: [],
                      windowKey: "",
                    }))
                  }
                >
                  {label}
                  {link.job_title ? (
                    <span className="client-book-staff-job">{link.job_title}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <select
            value={clientBookingForm.serviceId}
            onChange={(e) =>
              setClientBookingForm((p) => ({
                ...p,
                serviceId: e.target.value,
                optionIds: [],
                windowKey: "",
              }))
            }
            required
            disabled={!clientBookingForm.provider || bookableServices.length === 0}
          >
            <option value="">Услуга</option>
            {bookableServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.price} ₽
              </option>
            ))}
          </select>
          {serviceOptions.length > 0 ? (
            <div className="service-options-pick">
              <p className="field-label">Дополнительно</p>
              {serviceOptions.map((o) => {
                const on = (clientBookingForm.optionIds || []).map(Number).includes(Number(o.id));
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`service-option-chip${on ? " is-on" : ""}`}
                    onClick={() =>
                      setClientBookingForm((p) => {
                        const cur = (p.optionIds || []).map(Number);
                        const id = Number(o.id);
                        const next = on ? cur.filter((x) => x !== id) : [...cur, id];
                        return { ...p, optionIds: next, windowKey: "" };
                      })
                    }
                  >
                    <span className="service-option-plus">{on ? "✓" : "+"}</span>
                    <span>
                      {o.name}
                      {Number(o.price) > 0 ? ` · +${Number(o.price).toLocaleString("ru-RU")} ₽` : ""}
                      {Number(o.extra_minutes) > 0 ? ` · +${o.extra_minutes} мин` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {gallery.length > 0 ? (
            <ServicePhotoCarousel
              items={gallery}
              className="client-book-service-carousel"
              onOpen={(items, idx) =>
                openOrgPhotoLightbox(
                  items.map((it) => ({ id: it.id, url: it.url || it.image })),
                  idx,
                )
              }
            />
          ) : null}
          {clientBookingForm.provider && providerServices.length === 0 ? (
            <p className="muted small">Нет услуг, которые оказывают мастера организации. Назначьте услуги в настройках сотрудников.</p>
          ) : null}
          <MiniDatePicker
            label="Дата"
            value={clientBookingForm.bookDate}
            alwaysOpen
            availableDates={clientBookingForm.serviceId ? bookAvailableDates : null}
            onChange={(iso) => setClientBookingForm((p) => ({ ...p, bookDate: iso, windowKey: "" }))}
          />
          {!clientBookingForm.serviceId ? (
            <p className="muted small">Выберите мастера и услугу — доступные даты подсветятся в календаре.</p>
          ) : null}
          {clientBookingForm.serviceId && clientBookingForm.bookDate && (
            <>
              <p className="field-label">Свободное время</p>
              {clientBookWindows.length === 0 ? (
                <div>
                  <p className="muted small">Нет свободных интервалов на эту дату.</p>
                  <JoinWaitlistButton
                    authFetch={authFetch}
                    API_URL={API_URL}
                    providerId={clientBookingForm.provider}
                    serviceId={clientBookingForm.serviceId}
                    staffId={clientBookingForm.staffId}
                    preferredDate={clientBookingForm.bookDate}
                  />
                </div>
              ) : clientBookingForm.staffId !== "any" ? (
                <div
                  className="client-slot-strip client-book-slot-strip"
                  role="listbox"
                  aria-label="Время"
                >
                  {clientBookWindows.map((w) => {
                    const key = clientWindowKey(w);
                    const active = clientBookingForm.windowKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={["client-slot-chip", active && "client-slot-chip--active"].filter(Boolean).join(" ")}
                        onClick={() => setClientBookingForm((p) => ({ ...p, windowKey: key }))}
                      >
                        <span className="client-slot-chip-time">
                          {formatTimeHm(w.starts_at)} — {formatTimeHm(w.ends_at)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="client-staff-slots">
                  {groupClientWindowsByStaff(clientBookWindows).map((group) => (
                    <div key={group.staff_id ?? "none"} className="client-staff-slot-row">
                      <p className="client-staff-slot-name">{group.staff_label}</p>
                      <div
                        className="client-slot-strip client-book-slot-strip"
                        role="listbox"
                        aria-label={`Время · ${group.staff_label}`}
                      >
                        {group.windows.map((w) => {
                          const key = clientWindowKey(w);
                          const active = clientBookingForm.windowKey === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={["client-slot-chip", active && "client-slot-chip--active"].filter(Boolean).join(" ")}
                              onClick={() => setClientBookingForm((p) => ({ ...p, windowKey: key }))}
                            >
                              <span className="client-slot-chip-time">
                                {formatTimeHm(w.starts_at)} — {formatTimeHm(w.ends_at)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <input
            placeholder="Комментарий к записи"
            value={clientBookingForm.comment}
            onChange={(e) => setClientBookingForm((p) => ({ ...p, comment: e.target.value }))}
          />
          {bookClientPackages.length > 0 ? (
            <div className="client-book-package-box">
              <label className="checkbox loyalty-enable-row">
                <input
                  type="checkbox"
                  checked={Boolean(clientBookingForm.usePackage)}
                  onChange={(e) =>
                    setClientBookingForm((p) => ({ ...p, usePackage: e.target.checked }))
                  }
                />
                <span>Оплатить абонементом</span>
              </label>
              {clientBookingForm.usePackage ? (
                <select
                  value={clientBookingForm.clientPackageId}
                  onChange={(e) =>
                    setClientBookingForm((p) => ({ ...p, clientPackageId: e.target.value }))
                  }
                >
                  {bookClientPackages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.package_name} — осталось {p.visits_remaining}/{p.visits_total}
                    </option>
                  ))}
                </select>
              ) : null}
              <p className="muted small">При оплате абонементом списывается 1 визит, предоплата не нужна.</p>
            </div>
          ) : null}
          {bookLoyaltyInfo?.enabled &&
          Number(bookLoyaltyInfo.balance) > 0 &&
          !(clientBookingForm.usePackage && bookClientPackages.length) ? (
            <label className="field-label">
              Списать баллы (баланс {Number(bookLoyaltyInfo.balance).toLocaleString("ru-RU")}
              {bookLoyaltyInfo.rub_per_point
                ? `, 1 балл ≈ ${bookLoyaltyInfo.rub_per_point} ₽`
                : ""}
              )
              <input
                type="number"
                min="0"
                max={Number(bookLoyaltyInfo.balance) || 0}
                placeholder="0"
                value={clientBookingForm.loyaltyPoints}
                onChange={(e) =>
                  setClientBookingForm((p) => ({ ...p, loyaltyPoints: e.target.value }))
                }
              />
              {(() => {
                const pts = Number(clientBookingForm.loyaltyPoints) || 0;
                const rate = Number(bookLoyaltyInfo.rub_per_point) || 1;
                const svc = providerServices.find(
                  (s) => String(s.id) === String(clientBookingForm.serviceId)
                );
                const price = Number(svc?.price) || 0;
                if (!pts || !price) return null;
                const discount = Math.min(price, pts * rate);
                const due = Math.max(0, Math.round((price - discount) * 100) / 100);
                return (
                  <span className="field-hint">
                    Скидка ≈ {discount.toLocaleString("ru-RU")} ₽ · к оплате ≈{" "}
                    {due.toLocaleString("ru-RU")} ₽
                    {due <= 0 ? " (без карты)" : ""}
                  </span>
                );
              })()}
            </label>
          ) : null}
          <button type="submit" disabled={!clientBookingForm.windowKey}>
            {clientBookingForm.usePackage && bookClientPackages.length
              ? "Записаться по абонементу"
              : mapOrgProfile?.prepay?.ready
                ? "Перейти к оплате"
                : "Подтвердить"}
          </button>
        </form>
        <p className="status">{clientStatus}</p>
      </div>
    </div>
  );
}
