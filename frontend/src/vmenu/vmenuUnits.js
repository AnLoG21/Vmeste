/** Client-side ingredient scaling and unit conversion (mirrors backend vmenu/units.py). */

const TO_BASE = {
  г: ["mass", 1],
  кг: ["mass", 1000],
  мл: ["volume", 1],
  л: ["volume", 1000],
  "ч.л.": ["volume", 5],
  "ст.л.": ["volume", 15],
  "шт.": ["count", 1],
  стакан: ["volume", 250],
  щепотка: ["count", 1],
};

const DISPLAY_UNITS = {
  mass: ["г", "кг"],
  volume: ["мл", "л", "ч.л.", "ст.л."],
  count: ["шт."],
};

export const ALL_UNITS = ["г", "кг", "мл", "л", "ч.л.", "ст.л.", "шт.", "стакан", "щепотка", "зубчик", "по вкусу"];

function q(n) {
  return Math.round(n * 1000) / 1000;
}

export function convertUnit(amount, fromUnit, toUnit) {
  const from = TO_BASE[fromUnit] || TO_BASE["г"];
  const to = TO_BASE[toUnit];
  if (!to || from[0] !== to[0]) return null;
  const val = Number(amount) || 0;
  return q((val * from[1]) / to[1]);
}

export function scaleIngredients(ingredients, baseServings, targetServings, displayUnit) {
  const base = Math.max(1, Number(baseServings) || 1);
  const target = Math.max(1, Number(targetServings) || 1);
  const factor = target / base;
  return (ingredients || []).map((ing) => {
    const raw = Number(ing.amount);
    const hasAmount = ing.amount !== "" && ing.amount != null && Number.isFinite(raw) && raw !== 0;
    if (!hasAmount) {
      return { ...ing, amount: ing.amount ?? "", unit: ing.unit || "" };
    }
    let amount = q(raw * factor);
    let unit = ing.unit || "";
    if (displayUnit && unit) {
      const converted = convertUnit(amount, unit, displayUnit);
      if (converted != null) {
        amount = converted;
        unit = displayUnit;
      }
    }
    return { ...ing, amount, unit };
  });
}

export function compatibleUnits(unit) {
  const u = (unit || "").trim();
  if (u === "по вкусу" || u === "зубчик" || u === "щепотка") return [u];
  const meta = TO_BASE[u || "г"];
  if (!meta) return ALL_UNITS;
  return DISPLAY_UNITS[meta[0]] || ["шт."];
}

export function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount || "");
  if (Number.isInteger(n)) return String(n);
  return String(q(n));
}

export function formatIngredientLine(ing) {
  const name = ing.name || "";
  const unit = (ing.unit || "").trim();
  const amt = ing.amount;
  if (amt === "" || amt == null) {
    return unit ? `${name} — ${unit}` : name;
  }
  const n = Number(amt);
  if (!Number.isFinite(n) || n === 0) {
    return unit ? `${name} — ${unit}` : name;
  }
  if (!unit) return `${name} — ${formatAmount(amt)}`;
  return `${name} — ${formatAmount(amt)} ${unit}`;
}
