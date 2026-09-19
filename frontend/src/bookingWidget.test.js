import { describe, expect, it } from "vitest";
import { buildBookingWidgetSnapshot } from "./bookingWidget.js";

function hoursFromNow(h) {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

describe("bookingWidget", () => {
  it("builds today and next lines for provider", () => {
    const todayIso = new Date().toISOString();
    const later = hoursFromNow(3);
    const snap = buildBookingWidgetSnapshot(
      [
        {
          id: 1,
          status: "confirmed",
          slot_starts_at: todayIso,
          client: 10,
          client_display_name: "Анна",
          service_name: "Стрижка",
        },
        {
          id: 2,
          status: "confirmed",
          slot_starts_at: later,
          client: 11,
          client_display_name: "Борис",
          service_name: "Окрашивание",
        },
      ],
      { asClient: false },
    );
    expect(snap.todayLine).toMatch(/^Сегодня \d+ /);
    expect(snap.nextLine).toContain("·");
    expect(snap.nextTime).toMatch(/\d/);
  });

  it("builds client-facing today line", () => {
    const snap = buildBookingWidgetSnapshot(
      [
        {
          id: 5,
          status: "confirmed",
          slot_starts_at: new Date().toISOString(),
          service_name: "Маникюр",
          staff_display_name: "Лена",
        },
      ],
      { asClient: true },
    );
    expect(snap.todayLine).toMatch(/Сегодня 1 запис/);
  });

  it("skips cancelled and past-only lists for next", () => {
    const snap = buildBookingWidgetSnapshot(
      [
        {
          id: 9,
          status: "cancelled",
          slot_starts_at: hoursFromNow(2),
          client_display_name: "X",
        },
      ],
      { asClient: false },
    );
    expect(snap.nextLine).toBe("");
    expect(snap.nextTime).toBe("");
  });
});
