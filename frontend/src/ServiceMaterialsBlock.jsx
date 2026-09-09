import { useCallback, useEffect, useState } from "react";
import { API_URL } from "./config.js";
import { showToast } from "./toast.js";

/** Нормы расхода товаров на услугу (BOM). */
export default function ServiceMaterialsBlock({ serviceId, authFetch }) {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!serviceId || !authFetch) return;
    const [mRes, pRes] = await Promise.all([
      authFetch(`${API_URL}/shop/materials/?service=${encodeURIComponent(serviceId)}`),
      authFetch(`${API_URL}/shop/products/`),
    ]);
    if (mRes.ok) {
      const list = await mRes.json();
      setMaterials(Array.isArray(list) ? list : list.results || []);
    }
    if (pRes.ok) {
      const list = await pRes.json();
      setProducts(Array.isArray(list) ? list : list.results || []);
    }
  }, [authFetch, serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addMaterial() {
    if (!productId) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/materials/`, {
        method: "POST",
        body: JSON.stringify({
          service: serviceId,
          product: Number(productId),
          qty_per_service: qty || "1",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось добавить");
      setProductId("");
      setQty("1");
      await load();
      showToast("Расходник добавлен");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function removeMaterial(id) {
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/materials/${id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Не удалось удалить");
      await load();
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!authFetch) return null;

  return (
    <div className="service-editor-materials">
      <span className="small-label">Расходники (списываются при «Услуга оказана»)</span>
      {materials.length === 0 ? (
        <p className="muted small">Пока не привязаны. Добавьте товары из магазина.</p>
      ) : (
        <ul className="service-editor-materials-list">
          {materials.map((m) => (
            <li key={m.id} className="service-editor-materials-item">
              <span className="service-editor-materials-name">
                {m.product_name}
                <span className="muted">
                  {" "}
                  · {m.qty_per_service} {m.product_unit || "шт"}
                </span>
              </span>
              <button
                type="button"
                className="service-editor-icon-delete"
                disabled={busy}
                title="Удалить"
                aria-label="Удалить"
                onClick={() => void removeMaterial(m.id)}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="service-editor-materials-add">
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Товар…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0.001"
          step="0.001"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Кол-во"
          aria-label="Количество"
        />
        <button
          type="button"
          className="service-editor-icon-add"
          disabled={busy || !productId}
          title="Добавить"
          aria-label="Добавить"
          onClick={() => void addMaterial()}
        >
          +
        </button>
      </div>
    </div>
  );
}
