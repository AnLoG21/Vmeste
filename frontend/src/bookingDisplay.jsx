export function bookingSlotStatusModifier(bookingOrStatus, endsAt) {
  const status = typeof bookingOrStatus === "object" && bookingOrStatus
    ? bookingOrStatus.status
    : bookingOrStatus;
  const endRaw =
    typeof bookingOrStatus === "object" && bookingOrStatus
      ? bookingOrStatus.slot_ends_at || bookingOrStatus.ends_at
      : endsAt;
  if (status === "cancelled") return "booking-slot--cancelled";
  if (status === "done") return "booking-slot--done";
  if (status === "no_show") return "booking-slot--noshow";
  if (status === "manual_hold") return "booking-slot--manual-hold";
  const pay = typeof bookingOrStatus === "object" ? bookingOrStatus.payment_status : "";
  if (pay === "pending") return "booking-slot--pending";
  const endMs = endRaw ? new Date(endRaw).getTime() : NaN;
  if (Number.isFinite(endMs) && endMs < Date.now() && (status === "new" || status === "confirmed")) {
    return "booking-slot--overdue";
  }
  if (status === "confirmed") return "booking-slot--confirmed";
  if (status === "new") return "booking-slot--new";
  return "";
}

export function bookingSlotCompactIcon(statusModifier) {
  if (statusModifier === "booking-slot--cancelled") return "✕";
  if (statusModifier === "booking-slot--done") return "✓";
  if (statusModifier === "booking-slot--noshow") return "∅";
  if (statusModifier === "booking-slot--overdue") return "!";
  if (statusModifier === "booking-slot--confirmed") return "●";
  if (statusModifier === "booking-slot--pending") return "₽";
  if (statusModifier === "booking-slot--manual-hold") return "○";
  return "○";
}

export const BOOKING_STATUS_LABELS = {
  new: "Новая",
  confirmed: "Подтверждена",
  arrived: "Клиент пришёл",
  cancelled: "Отменена",
  done: "Оказана",
  no_show: "Неявка",
  manual_hold: "Ручная бронь",
};

export function bookingStatusLabel(statusOrBooking) {
  if (typeof statusOrBooking === "object" && statusOrBooking) {
    const pay = statusOrBooking.payment_status;
    if (pay === "pending") return "Ожидает оплату";
    if (pay === "paid" && statusOrBooking.status === "new") return "Предоплата внесена";
    if (pay === "expired") return "Оплата не прошла";
    return BOOKING_STATUS_LABELS[statusOrBooking.status] || statusOrBooking.status || "";
  }
  return BOOKING_STATUS_LABELS[statusOrBooking] || statusOrBooking || "";
}

export function bookingPrepayHint(prepay) {
  if (!prepay?.ready) return "";
  if (prepay.mode === "full") {
    return "Для записи нужна полная предоплата через ЮKassa. Слот держится 10 минут до оплаты.";
  }
  if (prepay.mode === "percent") {
    return `Для записи нужна предоплата ${prepay.percent}% через ЮKassa. Слот держится 10 минут до оплаты.`;
  }
  return "";
}

/** Estimate payable / prepay amount for the client book submit button. */
export function estimateClientBookCharge({
  service,
  optionIds = [],
  loyaltyPoints = 0,
  rubPerPoint = 1,
  usePackage = false,
  hasPackages = false,
  prepay = null,
}) {
  if (usePackage && hasPackages) {
    return {
      total: 0,
      charge: 0,
      submitLabel: "Записаться по абонементу",
    };
  }
  let total = Number(service?.price) || 0;
  const selected = new Set((optionIds || []).map(Number));
  for (const opt of service?.options || []) {
    if (!selected.has(Number(opt.id))) continue;
    if (opt.is_active === false) continue;
    total += Number(opt.price) || 0;
  }
  const pts = Number(loyaltyPoints) || 0;
  const rate = Number(rubPerPoint) || 1;
  const discount = pts > 0 && total > 0 ? Math.min(total, pts * rate) : 0;
  const payable = Math.max(0, Math.round((total - discount) * 100) / 100);
  const money = (n) => `${Number(n).toLocaleString("ru-RU")} ₽`;

  if (prepay?.ready && payable > 0) {
    let charge = payable;
    if (prepay.mode === "percent") {
      const percent = Math.min(100, Math.max(1, Number(prepay.percent) || 50));
      charge = Math.round(((payable * percent) / 100) * 100) / 100;
      if (charge <= 0) charge = payable;
    }
    return {
      total: payable,
      charge,
      submitLabel: `Перейти к оплате · ${money(charge)}`,
    };
  }

  if (payable <= 0) {
    return {
      total: 0,
      charge: 0,
      submitLabel: "Подтвердить запись",
    };
  }

  return {
    total: payable,
    charge: payable,
    submitLabel: `Подтвердить · ${money(payable)}`,
  };
}

export function formatInAppNotificationText(n) {
  const title = (n?.payload?.title || "").trim();
  const body = (n?.payload?.body || "").trim();
  const when =
    (n?.payload?.when || "").trim() ||
    (n?.payload?.starts_at ? formatBookingDateTime(n.payload.starts_at) : "");
  if (title && body) return [title, body, when].filter(Boolean).join(" · ");
  if (body) return [body, when].filter(Boolean).join(" · ");
  if (title) return [title, when].filter(Boolean).join(" · ");
  if (n?.kind === "staff_invite_accepted") {
    return `Сотрудник ${n.payload?.staff_name || ""} принял приглашение.`.trim();
  }
  if (n?.kind === "booking") {
    const service = n?.payload?.service_name;
    const when = n?.payload?.when;
    const parts = [service, when].filter(Boolean);
    return parts.length ? `Запись: ${parts.join(" · ")}` : "Новая запись";
  }
  if (n?.kind === "chat_message") return "Новое сообщение в чате";
  if (n?.kind === "review") return "Новый отзыв";
  if (n?.kind === "inspection") {
    return (n?.payload?.title || n?.payload?.body || "Согласование диагностики").trim();
  }
  if (n?.kind === "cafe_new_order" || n?.kind === "cafe_waiter_call") {
    return [n?.payload?.title, n?.payload?.body].filter(Boolean).join(" · ") || "Кафе";
  }
  return "Уведомление";
}

export function formatBookingPrice(price) {
  if (price == null || price === "") return "—";
  const n = Number(price);
  if (Number.isNaN(n)) return String(price);
  return `${n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

export function reviewIsSupplemented(review) {
  return Boolean(review?.supplemented_at);
}

export function splitSupplementedReviewText(review) {
  const text = String(review?.text || "").trim();
  if (!reviewIsSupplemented(review)) {
    return { main: text, supplement: "" };
  }
  const sep = text.lastIndexOf("\n\n");
  if (sep >= 0) {
    return {
      main: text.slice(0, sep).trim(),
      supplement: text.slice(sep + 2).trim(),
    };
  }
  return { main: text, supplement: "" };
}

export function ReviewSupplementEnterIcon() {
  return (
    <span className="review-supplemented-enter-icon" aria-hidden="true">
      ↪
    </span>
  );
}

export function ReviewTextContent({ review, mainClassName = "review-item-text", supplementClassName = "review-text-supplement" }) {
  const { main, supplement } = splitSupplementedReviewText(review);
  if (!reviewIsSupplemented(review)) {
    return main ? <p className={mainClassName}>{main}</p> : null;
  }
  const showSupplementBlock = Boolean(supplement) || reviewIsSupplemented(review);
  if (!main && !showSupplementBlock) return null;
  return (
    <div className="review-text-stack">
      {main ? <p className={mainClassName}>{main}</p> : null}
      {showSupplementBlock && (
        <div className="review-supplemented-block">
          <div className="review-supplemented-label-row">
            <ReviewSupplementEnterIcon />
            <span className="review-supplemented-label">Отзыв дополнен</span>
          </div>
          {supplement ? <p className={supplementClassName}>{supplement}</p> : null}
        </div>
      )}
    </div>
  );
}

export function formatBookingDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
}

export function formatBookingDateTimeParts(iso) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: String(iso), time: "" };
  return {
    date: d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    time: d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
  };
}

