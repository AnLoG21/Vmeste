/** Marketplace analytics helpers (KPI, funnel, warehouse, unit econ, bubbles). */

export function extractRecords(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.cards)) return data.cards;
  if (Array.isArray(data.result)) return data.result;
  if (Array.isArray(data.result?.data)) return data.result.data;
  if (Array.isArray(data.report)) return data.report;
  return [];
}

export function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 0));
  return d.toISOString();
}

export function normalizeBuhRow(row) {
  const r = row || {};
  const sku = String(r.sa_name || r.supplierArticle || r.vendorCode || "").trim();
  const nm = r.nm_id ?? r.nmId ?? r.nmID ?? "";
  const brand = String(r.brand_name || r.brandName || r.brand || "").trim();
  const oper = String(r.supplier_oper_name || r.supplierOperName || r.doc_type_name || "").trim();
  const qty = Number(r.quantity || r.quantityFull || 0) || 0;
  const retail = Number(r.retail_amount || r.retailAmount || r.retail_price_withdisc_rub || 0) || 0;
  const forPay = Number(r.ppvz_for_pay || r.ppvzForPay || r.finishedPrice || 0) || 0;
  const commission = Number(r.ppvz_sales_commission || r.ppvzSalesCommission || 0) || 0;
  const delivery = Number(r.delivery_rub || r.deliveryRub || 0) || 0;
  const storage = Number(r.storage_fee || r.storageFee || 0) || 0;
  const logistics = Number(r.rebill_logistic_cost || r.rebillLogisticCost || 0) || 0;
  const spp = Number(r.ppvz_spp_prc || r.ppvzSppPrc || r.spp || 0) || 0;
  const date = String(r.rr_dt || r.sale_dt || r.saleDt || r.order_dt || r.date || "").slice(0, 10);
  const low = oper.toLowerCase();
  const isReturn = low.includes("возврат") || low.includes("return");
  const isSale = !isReturn && (low.includes("продаж") || !oper || low === "продажа" || low === "sale");
  return {
    sku: sku || String(nm || "SKU"),
    nm_id: nm != null && nm !== "" ? String(nm) : "",
    brand,
    operation: oper,
    is_sale: isSale,
    is_return: isReturn,
    quantity: qty,
    retail_amount: retail,
    for_pay: forPay,
    commission,
    delivery_rub: delivery,
    storage_fee: storage,
    rebill_logistic_cost: logistics,
    spp_percent: spp,
    date,
  };
}

export function aggregateBuhRows(rows) {
  const norms = (rows || []).filter(Boolean).map(normalizeBuhRow);
  let ordersSum = 0;
  let forPay = 0;
  let commission = 0;
  let logistics = 0;
  let storage = 0;
  let qtySale = 0;
  let qtyReturn = 0;
  const bySku = {};
  const byDay = {};
  const byBrand = {};

  for (const n of norms) {
    const sign = n.is_return ? -1 : 1;
    const pay = n.for_pay * sign;
    const retail = n.retail_amount * sign;
    const q = n.quantity * sign;
    if (n.is_return) qtyReturn += Math.abs(n.quantity);
    else {
      qtySale += Math.max(0, n.quantity);
      ordersSum += Math.max(0, retail);
    }
    forPay += pay;
    commission += n.commission;
    logistics += n.delivery_rub + n.rebill_logistic_cost;
    storage += n.storage_fee;

    const slot = (bySku[n.sku] ||= {
      sku: n.sku,
      nm_id: n.nm_id,
      brand: n.brand,
      qty: 0,
      retail: 0,
      for_pay: 0,
    });
    slot.qty += q;
    slot.retail += retail;
    slot.for_pay += pay;

    const day = n.date || "—";
    const dslot = (byDay[day] ||= { date: day, qty: 0, retail: 0, for_pay: 0 });
    dslot.qty += q;
    dslot.retail += retail;
    dslot.for_pay += pay;

    const brand = n.brand || "—";
    const bslot = (byBrand[brand] ||= { brand, qty: 0, for_pay: 0 });
    bslot.qty += q;
    bslot.for_pay += pay;
  }

  return {
    kpis: {
      orders_sum: Math.round(ordersSum * 100) / 100,
      for_pay: Math.round(forPay * 100) / 100,
      commission: Math.round(commission * 100) / 100,
      logistics: Math.round(logistics * 100) / 100,
      storage: Math.round(storage * 100) / 100,
      qty_sale: qtySale,
      qty_return: qtyReturn,
      profit_est: Math.round((forPay - logistics - storage) * 100) / 100,
    },
    by_sku: Object.values(bySku).sort((a, b) => b.for_pay - a.for_pay),
    by_day: Object.values(byDay).sort((a, b) => String(a.date).localeCompare(String(b.date))),
    by_brand: Object.values(byBrand).sort((a, b) => b.for_pay - a.for_pay),
    rows: norms,
  };
}

export function parseNmReportCards(data) {
  const cards =
    data?.data?.cards ||
    data?.cards ||
    data?.data ||
    extractRecords(data);
  return (Array.isArray(cards) ? cards : []).map((card, i) => {
    const nm = card.nmID ?? card.nmId ?? card.nm_id ?? card.object?.id;
    const vendor = card.vendorCode || card.vendor_code || card.sa_name || "";
    const brand = card.brandName || card.brand || "";
    const stats = card.statistics?.selectedPeriod || card.selectedPeriod || card.statistics || {};
    const conv = stats.conversions || card.conversions || {};
    return {
      key: String(nm || vendor || i),
      sku: String(vendor || nm || "SKU"),
      nm_id: nm != null ? String(nm) : "",
      brand: String(brand || ""),
      open_card: Number(stats.openCardCount || 0) || 0,
      add_to_cart: Number(stats.addToCartCount || 0) || 0,
      orders: Number(stats.ordersCount || 0) || 0,
      orders_sum: Number(stats.ordersSumRub || 0) || 0,
      buyouts: Number(stats.buyoutsCount || 0) || 0,
      buyouts_sum: Number(stats.buyoutsSumRub || 0) || 0,
      cancel: Number(stats.cancelCount || 0) || 0,
      cancel_sum: Number(stats.cancelSumRub || 0) || 0,
      conv_cart: Number(conv.addToCartPercent || 0) || 0,
      conv_order: Number(conv.cartToOrderPercent || 0) || 0,
      conv_buyout: Number(conv.buyoutsPercent || 0) || 0,
    };
  });
}

export function parseWarehouseRows(data, marketplace) {
  const rows = Array.isArray(data) ? data : extractRecords(data);
  const byKey = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const wh =
      marketplace === "wildberries"
        ? String(row.warehouseName || row.warehouse || row.scName || "Склад")
        : String(row.warehouse_name || row.warehouse || row.name || "Склад");
    const sku =
      marketplace === "wildberries"
        ? String(row.supplierArticle || row.sa_name || row.nmId || row.barcode || "SKU")
        : String(row.offer_id || row.sku || row.item_code || "SKU");
    const qty = Number(
      marketplace === "wildberries"
        ? row.quantity ?? row.quantityFull ?? 0
        : row.free_to_sell_amount ?? row.promised_amount ?? row.stock ?? row.quantity ?? 0,
    ) || 0;
    const toClient = Number(row.inWayToClient || row.in_way_to_client || 0) || 0;
    const fromClient = Number(row.inWayFromClient || row.in_way_from_client || 0) || 0;
    const key = `${wh}||${sku}`;
    const slot = (byKey[key] ||= {
      warehouse: wh,
      sku,
      quantity: 0,
      in_way_to_client: 0,
      in_way_from_client: 0,
      sales_hint: 0,
    });
    slot.quantity += qty;
    slot.in_way_to_client += toClient;
    slot.in_way_from_client += fromClient;
  }
  return Object.values(byKey);
}

/** Days of stock ≈ periodDays * stock / salesQty (wb-man warehouse formula simplified). */
export function enrichWarehouseTurnover(rows, salesBySku, periodDays = 30) {
  const days = Math.max(1, Number(periodDays) || 30);
  return (rows || []).map((row) => {
    const sold = Number(salesBySku?.[row.sku] || 0) || 0;
    const stock = Number(row.quantity || 0) + Number(row.in_way_to_client || 0) * 0.5;
    const daysOfStock = sold > 0 ? Math.floor((days * stock) / sold) : stock > 0 ? 999 : 0;
    return { ...row, sales_qty: sold, days_of_stock: daysOfStock };
  });
}

export function buildSkuBubbles(bySku) {
  const list = (bySku || []).slice(0, 40);
  const maxQty = Math.max(1, ...list.map((x) => Math.abs(Number(x.qty) || 0)));
  const maxPay = Math.max(1, ...list.map((x) => Math.abs(Number(x.for_pay) || 0)));
  return list.map((row) => {
    const qty = Math.abs(Number(row.qty) || 0);
    const pay = Math.abs(Number(row.for_pay) || 0);
    const size = 28 + Math.round((qty / maxQty) * 56);
    const heat = pay / maxPay;
    const color = `hsl(${Math.round(140 - heat * 120)} 55% ${42 + heat * 8}%)`;
    return {
      id: row.sku,
      label: row.sku,
      qty,
      for_pay: Math.round(pay * 100) / 100,
      size,
      color,
    };
  });
}

export function buildWarehouseHeatmap(rows) {
  const byWh = {};
  for (const row of rows || []) {
    const wh = row.warehouse || "Склад";
    const slot = (byWh[wh] ||= { warehouse: wh, quantity: 0, risk: 0 });
    slot.quantity += Number(row.quantity || 0) || 0;
    if ((row.days_of_stock || 0) > 0 && row.days_of_stock < 14) slot.risk += 1;
  }
  const list = Object.values(byWh);
  const maxQ = Math.max(1, ...list.map((x) => x.quantity));
  return list
    .map((row) => ({
      ...row,
      intensity: row.quantity / maxQ,
      risk_level: row.risk > 2 ? "high" : row.risk > 0 ? "mid" : "ok",
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

export function calcUnitEconomics({ price, cost, commissionPct, logistics, buyoutPct }) {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  const comm = (p * (Number(commissionPct) || 0)) / 100;
  const log = Number(logistics) || 0;
  const buyout = Math.min(100, Math.max(0, Number(buyoutPct) || 100)) / 100;
  const revenue = p * buyout;
  const margin = revenue - c - comm * buyout - log;
  return {
    revenue: Math.round(revenue * 100) / 100,
    commission: Math.round(comm * buyout * 100) / 100,
    logistics: Math.round(log * 100) / 100,
    cost: Math.round(c * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    margin_pct: revenue ? Math.round((margin / revenue) * 1000) / 10 : 0,
  };
}

/** SPP strategy: supplier price so buyer sees target after SPP. */
export function calcSppSupplierPrice(targetBuyer, sppPercent, supplierDiscount = 0) {
  const target = Number(targetBuyer) || 0;
  const spp = Number(sppPercent) || 0;
  const disc = Number(supplierDiscount) || 0;
  if (target <= 0 || spp < 0 || spp >= 100 || disc < 0 || disc >= 100) return null;
  const afterSpp = Math.ceil(target / (1 - spp / 100));
  if (disc > 0) return Math.ceil(afterSpp / (1 - disc / 100));
  return afterSpp;
}

export function filterBySku(rows, skuFilter, key = "sku") {
  const q = String(skuFilter || "").trim().toLowerCase();
  if (!q) return rows || [];
  return (rows || []).filter((r) => String(r[key] || "").toLowerCase().includes(q));
}

export function groupFinanceByPeriod(rows, period = "week") {
  const map = {};
  for (const row of rows || []) {
    const raw = String(row.date || row.operation_date || "").slice(0, 10);
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    let key = raw;
    if (period === "week") {
      const day = d.getDay() || 7;
      const mon = new Date(d);
      mon.setDate(d.getDate() - day + 1);
      key = mon.toISOString().slice(0, 10);
    } else if (period === "month") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    const amount = Number(row.for_pay ?? row.amount ?? row.accruals_for_sale ?? 0) || 0;
    const slot = (map[key] ||= { period: key, amount: 0, count: 0 });
    slot.amount += amount;
    slot.count += 1;
  }
  return Object.values(map).sort((a, b) => String(a.period).localeCompare(String(b.period)));
}
