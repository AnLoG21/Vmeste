/** Pure cafe checkout totals (mirrors CafeGuestPage / backend receipt math). */

export const SERVICE_CHARGE_PERCENT = 3;

export function estimateCafeGuestCharge({
  cartTotal = 0,
  tipPercent = 0,
  tipCustomMode = false,
  tipCustomAmount = 0,
  includeServiceCharge = true,
  deliveryAmount = 0,
} = {}) {
  const items = Math.max(0, Number(cartTotal) || 0);
  const tip = tipCustomMode
    ? Math.max(0, Number(tipCustomAmount) || 0)
    : Math.round(items * ((Number(tipPercent) || 0) / 100));
  const service = includeServiceCharge
    ? Math.round(items * (SERVICE_CHARGE_PERCENT / 100))
    : 0;
  const delivery = Math.max(0, Number(deliveryAmount) || 0);
  return {
    items,
    tip,
    service,
    delivery,
    total: items + tip + service + delivery,
  };
}
