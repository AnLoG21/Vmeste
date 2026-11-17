/**
 * Marketplace notifications for the seller UI.
 * Groups map to menu tabs so badges and the inbox stay aligned.
 */

export function buildMarketplaceNotifications({
  alerts = null,
  orderRows = [],
  reviewRows = [],
  opsSummary = null,
  mpLabel = "площадке",
} = {}) {
  const items = [];

  for (const row of alerts?.low_stock || []) {
    const name = row.name || row.offer_id || "товар";
    const stock = Number(row.stock ?? 0);
    items.push({
      id: `stock-${row.id}`,
      tab: "products",
      group: "products",
      severity: stock <= 0 ? "critical" : "warn",
      title: stock <= 0 ? "Товар закончился" : "Мало на складе",
      body:
        stock <= 0
          ? `«${name}», арт. ${row.offer_id}. Остаток 0 шт. Покупатели не смогут заказать, пока не пополните остаток.`
          : `«${name}», арт. ${row.offer_id}. Осталось ${stock} шт. Порог в настройках: ${alerts?.low_stock_threshold ?? "—"}.`,
      cta: "К товарам",
    });
  }

  for (const row of alerts?.failed_imports || []) {
    const name = row.name || row.offer_id || "карточка";
    const err = String(row.error || "").trim();
    items.push({
      id: `import-${row.id}`,
      tab: "products",
      group: "products",
      severity: "critical",
      title: "Карточка не выгрузилась",
      body: err
        ? `«${name}» не принята площадкой: ${err}`
        : `«${name}», арт. ${row.offer_id}. Выгрузка на ${mpLabel} завершилась с ошибкой. Откройте товар и повторите.`,
      cta: "К товарам",
    });
  }

  for (const row of alerts?.log_errors || []) {
    const hint = String(row.hint || row.error || "Ошибка API").trim();
    items.push({
      id: `log-${row.id}`,
      tab: "logs",
      group: "logs",
      severity: "warn",
      title: "Сбой запроса к площадке",
      body: hint.length > 220 ? `${hint.slice(0, 220)}…` : hint,
      cta: "К логам",
    });
  }

  const pending = Number(opsSummary?.counts?.pending_imports || opsSummary?.pending_imports || 0);
  if (pending > 0) {
    items.push({
      id: "pending-imports",
      tab: "products",
      group: "products",
      severity: "info",
      title: "Идёт проверка выгрузки",
      body: `${pending} карточек ещё обрабатываются на площадке. Обычно это занимает несколько минут.`,
      cta: "К товарам",
    });
  }

  const packOrders = (orderRows || []).filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return (
      s.includes("awaiting_packaging") ||
      s.includes("awaiting_approve") ||
      s === "new" ||
      s === "confirm" ||
      s === "processing" ||
      s === "pending"
    );
  });
  if (packOrders.length) {
    const sample = packOrders
      .slice(0, 3)
      .map((r) => r.number)
      .filter(Boolean)
      .join(", ");
    items.push({
      id: "orders-pack",
      tab: "orders",
      group: "orders",
      severity: "warn",
      title: packOrders.length === 1 ? "Нужно собрать заказ" : `Нужно собрать заказы: ${packOrders.length}`,
      body: sample
        ? `Отправления: ${sample}${packOrders.length > 3 ? "…" : ""}. Соберите и распечатайте этикетку.`
        : "Есть заказы, которые ждут сборки. Откройте раздел «Заказы».",
      cta: "К заказам",
    });
  }

  const unansweredReviews = (reviewRows || []).filter((r) => {
    if (r?.answered === false || r?.isAnswered === false) return true;
    if (r?.answer || r?.textAnswer || r?.reply) return false;
    return Boolean(r?.id || r?.review_id || r?.uuid);
  });
  if (Array.isArray(reviewRows) && reviewRows.length && unansweredReviews.length) {
    items.push({
      id: "reviews-unanswered",
      tab: "reviews",
      group: "reviews",
      severity: "info",
      title:
        unansweredReviews.length === 1
          ? "Есть отзыв без ответа"
          : `Отзывы без ответа: ${unansweredReviews.length}`,
      body: "Ответьте на отзывы без ответа.",
      cta: "К отзывам",
    });
  }

  return items;
}

export function countNotificationsByTab(items) {
  const byTab = {};
  for (const item of items || []) {
    const tab = item.tab || "manage";
    byTab[tab] = (byTab[tab] || 0) + 1;
  }
  return byTab;
}

export function notificationSummary(items) {
  const n = (items || []).length;
  if (!n) return "Нет новых сообщений";
  const critical = items.filter((x) => x.severity === "critical").length;
  if (critical) return `${n} сообщ. · ${critical} срочных`;
  return `${n} сообщений. Нажмите, чтобы раскрыть`;
}
