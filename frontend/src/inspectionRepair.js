/** Shared repair-funnel labels for inspections (service center). */

export const REPAIR_STATUS_LABELS = {
  none: "",
  waiting_parts: "Ждём запчасти",
  in_progress: "В работе",
  ready: "Готов",
  handed_over: "Выдан",
};

export function repairStatusLabel(status) {
  if (!status || status === "none") return "";
  return REPAIR_STATUS_LABELS[status] || status;
}

/** Short suffix for booking buttons, e.g. " · готов". */
export function repairStatusButtonSuffix(status) {
  const label = repairStatusLabel(status);
  if (!label) return "";
  return ` · ${label.toLowerCase()}`;
}

/** Client-facing CTA on booking surfaces. */
export function repairStatusClientCta(inspection) {
  if (!inspection) return "Диагностика";
  const repair = repairStatusLabel(inspection.repair_status);
  if (repair) {
    if (inspection.repair_status === "ready") return "Авто готово";
    if (inspection.repair_status === "handed_over") return "Авто выдано";
    if (inspection.repair_status === "waiting_parts") return "Ждём запчасти";
    return repair;
  }
  if (inspection.status === "sent") return "Согласовать";
  return "Диагностика";
}

export function repairStatusClientHistoryCta(inspection) {
  if (!inspection) return "Открыть диагностику";
  const repair = repairStatusLabel(inspection.repair_status);
  if (repair) {
    if (inspection.repair_status === "ready") return "Авто готово";
    if (inspection.repair_status === "handed_over") return "Авто выдано";
    if (inspection.repair_status === "waiting_parts") return "Ждём запчасти";
    if (inspection.repair_status === "in_progress") return "Ремонт в работе";
    return repair;
  }
  if (inspection.status === "sent") return "Согласовать диагностику";
  return "Открыть диагностику";
}

export const REPAIR_STATUS_TOAST = {
  waiting_parts: "Клиенту отправлено: ждём запчасти.",
  in_progress: "Клиенту отправлено: ремонт в работе.",
  ready: "Клиенту отправлено: авто готово.",
  handed_over: "Клиенту отправлено: авто выдано.",
};
