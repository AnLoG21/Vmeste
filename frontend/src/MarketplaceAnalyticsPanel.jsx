import { useMemo, useState } from "react";
import {
  aggregateBuhRows,
  buildSkuBubbles,
  buildWarehouseHeatmap,
  calcSppSupplierPrice,
  calcUnitEconomics,
  daysAgoIso,
  enrichWarehouseTurnover,
  extractRecords,
  filterBySku,
  groupFinanceByPeriod,
  parseNmReportCards,
  parseWarehouseRows,
} from "./marketplaceAnalytics.js";

function KpiCard({ label, value, hint }) {
  return (
    <div className="mp-kpi-card">
      <span className="mp-kpi-label">{label}</span>
      <strong className="mp-kpi-value">{value}</strong>
      {hint ? <em className="mp-kpi-hint">{hint}</em> : null}
    </div>
  );
}

function SkuBubbles({ items, onSelect }) {
  if (!items?.length) return <p className="muted small">Нет SKU для пузырьков</p>;
  return (
    <div className="mp-bubble-cloud" role="img" aria-label="Пузырьки SKU">
      {items.map((b) => (
        <button
          key={b.id}
          type="button"
          className="mp-bubble"
          style={{ width: b.size, height: b.size, background: b.color }}
          title={`${b.label}: ${b.qty} шт, ${b.for_pay.toLocaleString("ru-RU")} ₽`}
          onClick={() => onSelect?.(b.label)}
        >
          <span>{b.label.length > 8 ? `${b.label.slice(0, 7)}…` : b.label}</span>
        </button>
      ))}
    </div>
  );
}

function WarehouseHeatmap({ items }) {
  if (!items?.length) return <p className="muted small">Нет данных по складам</p>;
  return (
    <div className="mp-heat-grid">
      {items.map((cell) => (
        <div
          key={cell.warehouse}
          className={`mp-heat-cell mp-heat-${cell.risk_level}`}
          style={{ opacity: 0.45 + cell.intensity * 0.55 }}
          title={`${cell.warehouse}: ${cell.quantity} шт`}
        >
          <strong>{cell.warehouse}</strong>
          <span>{Number(cell.quantity).toLocaleString("ru-RU")} шт</span>
        </div>
      ))}
    </div>
  );
}

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toLocaleString("ru-RU");
}

/**
 * Interactive analytics for marketplaces cabin.
 */
export default function MarketplaceAnalyticsPanel({
  mp,
  mpCall,
  withBusy,
  busy,
  settings,
  authFetch,
  API_URL,
  onStatus,
  history = [],
}) {
  const base = `${API_URL}/marketplaces`;
  const [dateFrom, setDateFrom] = useState(() => daysAgoIso(30).slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [skuFilter, setSkuFilter] = useState("");
  const [kpis, setKpis] = useState(null);
  const [byDay, setByDay] = useState([]);
  const [bySku, setBySku] = useState([]);
  const [byBrand, setByBrand] = useState([]);
  const [funnel, setFunnel] = useState([]);
  const [warehouse, setWarehouse] = useState([]);
  const [bubbles, setBubbles] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [unitRows, setUnitRows] = useState([]);
  const [financePeriods, setFinancePeriods] = useState([]);
  const [financePeriod, setFinancePeriod] = useState("week");
  const [costDraft, setCostDraft] = useState(() => ({ ...(settings?.sku_costs || {}) }));
  const [sppRules, setSppRules] = useState(() =>
    Array.isArray(settings?.spp_rules) && settings.spp_rules.length
      ? settings.spp_rules
      : [{ offer_id: "", nm_id: "", target_buyer_price: "", supplier_discount: 0 }],
  );
  const [sppEnabled, setSppEnabled] = useState(Boolean(settings?.spp_reprice_enabled));
  const [sppPlans, setSppPlans] = useState([]);
  const [repriceLogs, setRepriceLogs] = useState([]);
  const [commissionPct, setCommissionPct] = useState(15);
  const [logisticsRub, setLogisticsRub] = useState(50);
  const [buyoutPct, setBuyoutPct] = useState(85);

  const periodDays = useMemo(() => {
    const a = new Date(dateFrom);
    const b = new Date(dateTo);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 30;
    return Math.max(1, Math.round((b - a) / 86400000) + 1);
  }, [dateFrom, dateTo]);

  const filteredFunnel = useMemo(() => filterBySku(funnel, skuFilter), [funnel, skuFilter]);
  const filteredBySku = useMemo(() => filterBySku(bySku, skuFilter), [bySku, skuFilter]);
  const filteredWarehouse = useMemo(() => filterBySku(warehouse, skuFilter), [warehouse, skuFilter]);

  async function loadAll() {
    await withBusy("analytics", async () => {
      let salesRows = [];
      let stocksData = null;
      let nmCards = [];

      if (mp === "wildberries") {
        const payload = { dateFrom, dateTo };
        const salesData = await mpCall("analytics.sales", payload, payload);
        if (salesData?.sandbox) {
          onStatus?.(salesData.message || "Тестовый режим — аналитика недоступна.");
          return;
        }
        salesRows = Array.isArray(salesData) ? salesData : extractRecords(salesData);
        try {
          stocksData = await mpCall("analytics.stocks", { dateFrom }, { dateFrom });
        } catch {
          stocksData = null;
        }
        try {
          const begin = `${dateFrom} 00:00:00`;
          const end = `${dateTo} 23:59:59`;
          const nm = await mpCall("analytics.nm_report", {
            timezone: "Europe/Moscow",
            period: { begin, end },
            page: 1,
          });
          nmCards = parseNmReportCards(nm);
        } catch {
          nmCards = [];
        }
      } else {
        const salesData = await mpCall("analytics.data", {
          date_from: dateFrom,
          date_to: dateTo,
          metrics: ["revenue", "ordered_units", "delivered_units", "returns"],
          dimension: ["sku"],
          limit: 100,
          offset: 0,
        });
        if (salesData?.sandbox) {
          onStatus?.(salesData.message || "Тестовый режим — аналитика недоступна.");
          return;
        }
        const result = salesData?.result || salesData;
        const rows = result?.data || result?.items || extractRecords(salesData);
        salesRows = (rows || []).map((row) => {
          const dims = row.dimensions || [];
          const metrics = row.metrics || [];
          return {
            sa_name: String(dims[0] ?? "SKU"),
            quantity: Number(metrics[1] ?? 0) || 0,
            retail_amount: Number(metrics[0] ?? 0) || 0,
            ppvz_for_pay: Number(metrics[0] ?? 0) || 0,
            supplier_oper_name: "Продажа",
            rr_dt: dateTo,
          };
        });
        try {
          stocksData = await mpCall("analytics.stocks", { limit: 100, offset: 0, warehouse_type: "ALL" });
        } catch {
          stocksData = null;
        }
      }

      const agg = aggregateBuhRows(salesRows);
      const salesMap = {};
      for (const s of agg.by_sku) salesMap[s.sku] = Math.abs(s.qty) || 0;

      const whRaw = parseWarehouseRows(stocksData, mp);
      const wh = enrichWarehouseTurnover(whRaw, salesMap, periodDays);
      const bub = buildSkuBubbles(agg.by_sku);
      const heat = buildWarehouseHeatmap(wh);

      setKpis(agg.kpis);
      setByDay(agg.by_day);
      setBySku(agg.by_sku);
      setByBrand(agg.by_brand);
      setFunnel(nmCards);
      setWarehouse(wh);
      setBubbles(bub);
      setHeatmap(heat);

      const costs = { ...(settings?.sku_costs || {}), ...costDraft };
      const units = agg.by_sku.slice(0, 40).map((row) => {
        const costKey = `${mp}:${row.sku}`;
        const cost = Number(costs[costKey] ?? costs[row.sku] ?? 0) || 0;
        const price = row.qty ? Math.abs(row.retail / row.qty) : Math.abs(row.for_pay);
        const funnelRow = nmCards.find((f) => f.sku === row.sku || f.nm_id === row.nm_id);
        const buyout = funnelRow?.conv_buyout || buyoutPct;
        const u = calcUnitEconomics({
          price,
          cost,
          commissionPct,
          logistics: logisticsRub,
          buyoutPct: buyout,
        });
        return { ...row, cost, price: Math.round(price * 100) / 100, ...u };
      });
      setUnitRows(units);

      const finGrouped = groupFinanceByPeriod(
        agg.by_day.map((d) => ({ date: d.date, for_pay: d.for_pay })),
        financePeriod,
      );
      setFinancePeriods(finGrouped);

      onStatus?.(
        `Аналитика ${dateFrom}…${dateTo}: SKU ${agg.by_sku.length}, воронка ${nmCards.length}, складов ${heat.length}.`,
      );
    });
  }

  async function saveCostsAndRules() {
    await withBusy("analytics-save", async () => {
      const cleaned = {};
      for (const [k, v] of Object.entries(costDraft || {})) {
        const key = String(k || "").trim();
        if (!key) continue;
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        cleaned[key] = n;
      }
      const rules = (sppRules || [])
        .filter((r) => r.offer_id || r.nm_id)
        .map((r) => ({
          offer_id: String(r.offer_id || ""),
          nm_id: String(r.nm_id || ""),
          target_buyer_price: Number(r.target_buyer_price) || 0,
          supplier_discount: Number(r.supplier_discount) || 0,
        }));
      const res = await authFetch(`${base}/settings/`, {
        method: "PATCH",
        body: JSON.stringify({
          sku_costs: cleaned,
          spp_rules: rules,
          spp_reprice_enabled: Boolean(sppEnabled),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сохранить.");
      onStatus?.("Себестоимость и правила СПП сохранены.");
    });
  }

  async function planSpp(apply = false) {
    await withBusy("spp", async () => {
      const observations = (history || []).slice(0, 80).map((h) => {
        const pd = h.product_data || {};
        return {
          offer_id: h.offer_id,
          nm_id: String(pd.nm_id || pd.nmID || pd.nmId || ""),
          current_price: Number(pd.price || 0) || 0,
          supplier_price: Number(pd.price || 0) || 0,
          client_price: Number(pd.price || 0) || 0,
          spp_percent: Number(pd.spp || pd.spp_percent || 20) || 20,
        };
      });
      const res = await authFetch(`${base}/reprice/spp/`, {
        method: "POST",
        body: JSON.stringify({
          apply,
          rules: sppRules,
          observations,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "СПП-план не построен.");
      setSppPlans(data.plans || []);
      onStatus?.(
        apply
          ? data.sandbox
            ? `Sandbox: записано ${(data.applied || []).length} планов без отправки цен.`
            : `Применено: ${(data.applied || []).length}.`
          : `План СПП: ${(data.plans || []).length} позиций.`,
      );
      await loadRepriceLogs();
    });
  }

  async function loadRepriceLogs() {
    const res = await authFetch(`${base}/reprice/logs/`);
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    setRepriceLogs(data.results || []);
  }

  function setCost(sku, value) {
    setCostDraft((p) => ({ ...p, [`${mp}:${sku}`]: value }));
  }

  return (
    <div className="mp-stack mp-analytics-panel">
      <div className="mp-analytics-filters cafe-form-panel mp-panel">
        <h3>Период и фильтры</h3>
        <div className="cafe-form-grid">
          <label>
            С
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label>
            По
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label>
            SKU / артикул
            <input
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              placeholder="фильтр по подстроке"
            />
          </label>
        </div>
        <div className="mp-actions">
          <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "analytics"} onClick={loadAll}>
            {busy === "analytics" ? "Загрузка…" : `Загрузить аналитику (${mp === "wildberries" ? "WB" : "Ozon"})`}
          </button>
        </div>
      </div>

      {kpis ? (
        <div className="mp-kpi-row">
          <KpiCard label="Заказы / розница" value={`${fmt(kpis.orders_sum)} ₽`} hint={`${fmt(kpis.qty_sale)} шт`} />
          <KpiCard label="К выплате" value={`${fmt(kpis.for_pay)} ₽`} hint="ppvz_for_pay" />
          <KpiCard label="Оценка P&L" value={`${fmt(kpis.profit_est)} ₽`} hint="выплата − логистика − хранение" />
          <KpiCard label="Возвраты" value={`${fmt(kpis.qty_return)} шт`} hint={`комиссии ${fmt(kpis.commission)} ₽`} />
        </div>
      ) : null}

      <div className="mp-analytics-grid">
        <div className="cafe-form-panel mp-panel">
          <h3>Инфографика SKU</h3>
          <p className="muted small">Размер = шт., цвет = к выплате. Клик — в фильтр.</p>
          <SkuBubbles items={bubbles} onSelect={setSkuFilter} />
        </div>
        <div className="cafe-form-panel mp-panel">
          <h3>Теплокарта складов</h3>
          <p className="muted small">Интенсивность = остаток; красный оттенок — риск дней запаса.</p>
          <WarehouseHeatmap items={heatmap} />
        </div>
      </div>

      {mp === "wildberries" ? (
        <div className="cafe-form-panel mp-panel">
          <h3>Воронка (nm-report)</h3>
          <p className="muted small">Карточка → корзина → заказ → выкуп. Нужен доступ Seller Analytics API.</p>
          {filteredFunnel.length ? (
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Открытия</th>
                    <th>Корзина</th>
                    <th>Заказы</th>
                    <th>Выкупы</th>
                    <th>Отмены</th>
                    <th>→корз%</th>
                    <th>→зак%</th>
                    <th>Выкуп%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunnel.slice(0, 50).map((row) => (
                    <tr key={row.key}>
                      <td>{row.sku}</td>
                      <td>{fmt(row.open_card)}</td>
                      <td>{fmt(row.add_to_cart)}</td>
                      <td>{fmt(row.orders)}</td>
                      <td>{fmt(row.buyouts)}</td>
                      <td>{fmt(row.cancel)}</td>
                      <td>{fmt(row.conv_cart)}</td>
                      <td>{fmt(row.conv_order)}</td>
                      <td>{fmt(row.conv_buyout)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted small">Нет данных воронки — загрузите период или проверьте права токена на аналитику.</p>
          )}
        </div>
      ) : null}

      <div className="cafe-form-panel mp-panel">
        <h3>Динамика по дням</h3>
        <div className="mp-table-wrap">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Шт.</th>
                <th>Розница</th>
                <th>К выплате</th>
              </tr>
            </thead>
            <tbody>
              {(byDay || []).map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{fmt(row.qty)}</td>
                  <td>{fmt(row.retail)}</td>
                  <td>{fmt(row.for_pay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!byDay.length ? <p className="muted small">Загрузите аналитику.</p> : null}
        </div>
      </div>

      <div className="cafe-form-panel mp-panel">
        <h3>Склад: остатки и дни запаса</h3>
        <div className="mp-table-wrap">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Склад</th>
                <th>SKU</th>
                <th>Остаток</th>
                <th>В пути к клиенту</th>
                <th>От клиента</th>
                <th>Продажи за период</th>
                <th>Дней запаса</th>
              </tr>
            </thead>
            <tbody>
              {filteredWarehouse.slice(0, 80).map((row, i) => (
                <tr key={`${row.warehouse}-${row.sku}-${i}`}>
                  <td>{row.warehouse}</td>
                  <td>{row.sku}</td>
                  <td>{fmt(row.quantity)}</td>
                  <td>{fmt(row.in_way_to_client)}</td>
                  <td>{fmt(row.in_way_from_client)}</td>
                  <td>{fmt(row.sales_qty)}</td>
                  <td>{row.days_of_stock >= 999 ? "∞" : fmt(row.days_of_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredWarehouse.length ? <p className="muted small">Нет складских строк.</p> : null}
        </div>
      </div>

      <div className="cafe-form-panel mp-panel">
        <h3>Юнит-экономика</h3>
        <p className="muted small">
          Закуп из себестоимости SKU + комиссия % + логистика + % выкупа. Без закупа маржа оценочная.
        </p>
        <div className="cafe-form-grid">
          <label>
            Комиссия МП, %
            <input type="number" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} />
          </label>
          <label>
            Логистика, ₽/шт
            <input type="number" value={logisticsRub} onChange={(e) => setLogisticsRub(e.target.value)} />
          </label>
          <label>
            Выкуп по умолчанию, %
            <input type="number" value={buyoutPct} onChange={(e) => setBuyoutPct(e.target.value)} />
          </label>
        </div>
        <div className="mp-table-wrap">
          <table className="mp-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Цена</th>
                <th>Закуп</th>
                <th>Комиссия</th>
                <th>Маржа</th>
                <th>Маржа %</th>
              </tr>
            </thead>
            <tbody>
              {filterBySku(unitRows, skuFilter).map((row) => (
                <tr key={row.sku}>
                  <td>{row.sku}</td>
                  <td>{fmt(row.price)}</td>
                  <td>
                    <input
                      className="mp-inline-input"
                      type="number"
                      value={costDraft[`${mp}:${row.sku}`] ?? ""}
                      placeholder="0"
                      onChange={(e) => setCost(row.sku, e.target.value)}
                    />
                  </td>
                  <td>{fmt(row.commission)}</td>
                  <td>{fmt(row.margin)}</td>
                  <td>{fmt(row.margin_pct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mp-actions">
          <button type="button" className="mp-btn" disabled={busy === "analytics-save"} onClick={saveCostsAndRules}>
            Сохранить себестоимость и СПП-правила
          </button>
        </div>
      </div>

      <div className="cafe-form-panel mp-panel">
        <h3>Финансы по периодам</h3>
        <div className="mp-actions">
          <label className="muted small">
            Группировка{" "}
            <select value={financePeriod} onChange={(e) => setFinancePeriod(e.target.value)}>
              <option value="day">Дни</option>
              <option value="week">Недели</option>
              <option value="month">Месяцы</option>
            </select>
          </label>
          <button
            type="button"
            className="mp-btn"
            onClick={() =>
              setFinancePeriods(
                groupFinanceByPeriod(
                  byDay.map((d) => ({ date: d.date, for_pay: d.for_pay })),
                  financePeriod,
                ),
              )
            }
          >
            Пересчитать
          </button>
        </div>
        <div className="mp-table-wrap">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Период</th>
                <th>Сумма к выплате</th>
                <th>Точек</th>
              </tr>
            </thead>
            <tbody>
              {financePeriods.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{fmt(row.amount)}</td>
                  <td>{fmt(row.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {byBrand.length ? (
          <>
            <h4>Топ брендов</h4>
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Бренд</th>
                    <th>Шт.</th>
                    <th>К выплате</th>
                  </tr>
                </thead>
                <tbody>
                  {byBrand.slice(0, 20).map((row) => (
                    <tr key={row.brand}>
                      <td>{row.brand}</td>
                      <td>{fmt(row.qty)}</td>
                      <td>{fmt(row.for_pay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        {filteredBySku.length ? (
          <>
            <h4>Топ SKU</h4>
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Шт.</th>
                    <th>К выплате</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBySku.slice(0, 20).map((row) => (
                    <tr key={row.sku}>
                      <td>{row.sku}</td>
                      <td>{fmt(row.qty)}</td>
                      <td>{fmt(row.for_pay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>

      {mp === "wildberries" ? (
        <div className="cafe-form-panel mp-panel">
          <h3>СПП-репрайс (полуавто)</h3>
          <p className="muted small">
            Цель — цена для покупателя после СПП. В sandbox цены не уходят на WB, только лог.
          </p>
          <label className="checkbox">
            <input type="checkbox" checked={sppEnabled} onChange={(e) => setSppEnabled(e.target.checked)} />
            Включить умную защиту цены (СПП)
          </label>
          {(sppRules || []).map((rule, idx) => (
            <div className="cafe-form-grid" key={idx}>
              <label>
                Артикул
                <input
                  value={rule.offer_id}
                  onChange={(e) =>
                    setSppRules((list) => list.map((r, i) => (i === idx ? { ...r, offer_id: e.target.value } : r)))
                  }
                />
              </label>
              <label>
                nmID
                <input
                  value={rule.nm_id}
                  onChange={(e) =>
                    setSppRules((list) => list.map((r, i) => (i === idx ? { ...r, nm_id: e.target.value } : r)))
                  }
                />
              </label>
              <label>
                Цель для покупателя, ₽
                <input
                  type="number"
                  value={rule.target_buyer_price}
                  onChange={(e) =>
                    setSppRules((list) =>
                      list.map((r, i) => (i === idx ? { ...r, target_buyer_price: e.target.value } : r)),
                    )
                  }
                />
              </label>
              <label>
                Скидка продавца, %
                <input
                  type="number"
                  value={rule.supplier_discount}
                  onChange={(e) =>
                    setSppRules((list) =>
                      list.map((r, i) => (i === idx ? { ...r, supplier_discount: e.target.value } : r)),
                    )
                  }
                />
              </label>
              <p className="muted small">
                Пример при СПП 20%: цена продавца ≈{" "}
                {calcSppSupplierPrice(rule.target_buyer_price, 20, rule.supplier_discount) ?? "—"}
              </p>
            </div>
          ))}
          <div className="mp-actions">
            <button
              type="button"
              className="mp-btn"
              onClick={() =>
                setSppRules((list) => [
                  ...list,
                  { offer_id: "", nm_id: "", target_buyer_price: "", supplier_discount: 0 },
                ])
              }
            >
              + правило
            </button>
            <button type="button" className="mp-btn" disabled={busy === "spp"} onClick={() => planSpp(false)}>
              Посчитать план
            </button>
            <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "spp"} onClick={() => planSpp(true)}>
              Применить (с логом)
            </button>
            <button type="button" className="mp-btn" onClick={loadRepriceLogs}>
              Обновить лог
            </button>
          </div>
          {sppPlans.length ? (
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>SKU/nm</th>
                    <th>Было</th>
                    <th>Станет</th>
                    <th>СПП%</th>
                    <th>Причина</th>
                  </tr>
                </thead>
                <tbody>
                  {sppPlans.map((p, i) => (
                    <tr key={i}>
                      <td>{p.offer_id || p.nm_id}</td>
                      <td>{fmt(p.old_price)}</td>
                      <td>{fmt(p.new_price)}</td>
                      <td>{fmt(p.spp_percent)}</td>
                      <td>{p.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {repriceLogs.length ? (
            <>
              <h4>Лог репрайса</h4>
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>Когда</th>
                      <th>nm/SKU</th>
                      <th>Было→стало</th>
                      <th>Sandbox</th>
                      <th>Применено</th>
                      <th>Причина</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repriceLogs.map((r) => (
                      <tr key={r.id}>
                        <td>{String(r.created_at || "").slice(0, 19).replace("T", " ")}</td>
                        <td>{r.offer_id || r.nm_id}</td>
                        <td>
                          {r.old_price}→{r.new_price}
                        </td>
                        <td>{r.sandbox ? "да" : "нет"}</td>
                        <td>{r.applied ? "да" : "нет"}</td>
                        <td>{r.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
