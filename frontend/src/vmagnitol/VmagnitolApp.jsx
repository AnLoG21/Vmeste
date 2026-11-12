import { useCallback, useEffect, useState } from "react";
import "./vmagnitol.css";
import VmagnitolLogo from "./VmagnitolLogo.jsx";
import { canAccessVmagnitol } from "./vmagnitolAccess.js";
import {
  createBrand,
  createGuide,
  createModel,
  createStep,
  deleteFile,
  deleteStep,
  getGuide,
  listBrands,
  updateGuide,
  updateStep,
  uploadFile,
} from "./vmagnitolApi.js";

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VmagnitolApp({ me, authFetch, API_URL, onExit }) {
  const allowed = canAccessVmagnitol(me);
  const [brands, setBrands] = useState([]);
  const [brand, setBrand] = useState(null);
  const [model, setModel] = useState(null);
  const [guide, setGuide] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [showModelForm, setShowModelForm] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [modelName, setModelName] = useState("");
  const [modelYears, setModelYears] = useState("");
  const [modelHu, setModelHu] = useState("");
  const [editingStepId, setEditingStepId] = useState(null);
  const [stepDraft, setStepDraft] = useState({ title: "", body: "", warning: "" });

  const refreshBrands = useCallback(async () => {
    const data = await listBrands(authFetch, API_URL);
    setBrands(Array.isArray(data) ? data : []);
    return data;
  }, [authFetch, API_URL]);

  const openGuide = useCallback(
    async (guideId) => {
      const g = await getGuide(authFetch, API_URL, guideId);
      setGuide(g);
    },
    [authFetch, API_URL],
  );

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError("");
      try {
        await refreshBrands();
      } catch (e) {
        if (!cancelled) setError(e.message || "Не удалось загрузить каталог");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowed, refreshBrands]);

  if (!allowed) {
    return (
      <section className="card vmagnitol-app cabinet-sheet">
        <h2>Вмагнитоле</h2>
        <p className="muted">Сервис доступен только по личному доступу.</p>
        <button type="button" className="ghost-btn" onClick={onExit}>
          ← К сервисам
        </button>
      </section>
    );
  }

  async function onCreateBrand(e) {
    e.preventDefault();
    if (!brandName.trim()) return;
    setBusy(true);
    setError("");
    try {
      await createBrand(authFetch, API_URL, { name: brandName.trim() });
      setBrandName("");
      setShowBrandForm(false);
      await refreshBrands();
    } catch (err) {
      setError(err.message || "Не удалось создать марку");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateModel(e) {
    e.preventDefault();
    if (!brand || !modelName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const m = await createModel(authFetch, API_URL, brand.id, {
        name: modelName.trim(),
        years: modelYears.trim(),
        head_unit: modelHu.trim(),
      });
      const g = await createGuide(authFetch, API_URL, m.id, {
        title: `Прошивка и русификация — ${m.name}`,
        summary: "Новый гайд. Добавьте этапы и файлы.",
        status: "draft",
      });
      setModelName("");
      setModelYears("");
      setModelHu("");
      setShowModelForm(false);
      const data = await refreshBrands();
      const b = (data || []).find((x) => x.id === brand.id) || brand;
      setBrand(b);
      const refreshed = (b.models || []).find((x) => x.id === m.id) || m;
      setModel(refreshed);
      await openGuide(g.id);
    } catch (err) {
      setError(err.message || "Не удалось создать модель");
    } finally {
      setBusy(false);
    }
  }

  async function openModel(m) {
    setModel(m);
    setGuide(null);
    setError("");
    const first = (m.guides || [])[0];
    if (first) {
      setBusy(true);
      try {
        await openGuide(first.id);
      } catch (err) {
        setError(err.message || "Не удалось открыть гайд");
      } finally {
        setBusy(false);
      }
    }
  }

  async function onAddStep() {
    if (!guide) return;
    setBusy(true);
    setError("");
    try {
      await createStep(authFetch, API_URL, guide.id, {
        title: "Новый шаг",
        body: "",
        warning: "",
      });
      await openGuide(guide.id);
    } catch (err) {
      setError(err.message || "Не удалось добавить шаг");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveStep(stepId) {
    setBusy(true);
    setError("");
    try {
      await updateStep(authFetch, API_URL, stepId, stepDraft);
      setEditingStepId(null);
      await openGuide(guide.id);
    } catch (err) {
      setError(err.message || "Не удалось сохранить шаг");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteStep(stepId) {
    if (!window.confirm("Удалить шаг?")) return;
    setBusy(true);
    try {
      await deleteStep(authFetch, API_URL, stepId);
      await openGuide(guide.id);
    } catch (err) {
      setError(err.message || "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(stepId, file) {
    if (!guide || !file) return;
    setBusy(true);
    setError("");
    try {
      await uploadFile(authFetch, API_URL, guide.id, file, {
        title: file.name,
        stepId,
      });
      await openGuide(guide.id);
    } catch (err) {
      setError(err.message || "Не удалось загрузить файл");
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePublish() {
    if (!guide) return;
    setBusy(true);
    try {
      const next = guide.status === "published" ? "draft" : "published";
      await updateGuide(authFetch, API_URL, guide.id, { status: next });
      await openGuide(guide.id);
    } catch (err) {
      setError(err.message || "Не удалось обновить статус");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card vmagnitol-app cabinet-sheet full-width">
      <div className="vmagnitol-head">
        <VmagnitolLogo size={48} />
        <div>
          <h2>Вмагнитоле</h2>
          <p className="muted">Прошивка и русификация штатных ГУ: марки → модели → поэтапные инструкции и файлы.</p>
        </div>
        <div className="vmagnitol-actions">
          <button type="button" className="ghost-btn" onClick={onExit}>
            ← К сервисам
          </button>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {busy ? <p className="muted">Загрузка…</p> : null}

      <nav className="vmagnitol-crumb" aria-label="Навигация">
        <button
          type="button"
          onClick={() => {
            setBrand(null);
            setModel(null);
            setGuide(null);
          }}
        >
          Марки
        </button>
        {brand ? (
          <>
            <span>/</span>
            <button
              type="button"
              onClick={() => {
                setModel(null);
                setGuide(null);
              }}
            >
              {brand.name}
            </button>
          </>
        ) : null}
        {model ? (
          <>
            <span>/</span>
            <span>{model.name}</span>
          </>
        ) : null}
      </nav>

      {!brand ? (
        <>
          <div className="vmagnitol-actions" style={{ marginLeft: 0 }}>
            <button type="button" className="primary-btn" disabled={busy} onClick={() => setShowBrandForm((v) => !v)}>
              + Марка
            </button>
          </div>
          {showBrandForm ? (
            <form className="vmagnitol-form" onSubmit={onCreateBrand}>
              <input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Например: Geely"
                required
              />
              <button type="submit" className="primary-btn" disabled={busy}>
                Создать марку
              </button>
            </form>
          ) : null}
          <div className="vmagnitol-grid">
            {brands.map((b) => (
              <button
                key={b.id}
                type="button"
                className="vmagnitol-card"
                onClick={() => {
                  setBrand(b);
                  setModel(null);
                  setGuide(null);
                }}
              >
                <strong>{b.name}</strong>
                <p className="muted small">{b.models_count || (b.models || []).length || 0} мод.</p>
              </button>
            ))}
          </div>
          {!brands.length && !busy ? <p className="muted">Пока нет марок. Добавьте первую.</p> : null}
        </>
      ) : null}

      {brand && !model ? (
        <>
          <div className="vmagnitol-actions" style={{ marginLeft: 0 }}>
            <button type="button" className="primary-btn" disabled={busy} onClick={() => setShowModelForm((v) => !v)}>
              + Модель
            </button>
          </div>
          {showModelForm ? (
            <form className="vmagnitol-form" onSubmit={onCreateModel}>
              <input value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Coolray" required />
              <input value={modelYears} onChange={(e) => setModelYears(e.target.value)} placeholder="Годы, напр. 2019+" />
              <input
                value={modelHu}
                onChange={(e) => setModelHu(e.target.value)}
                placeholder="Штатная ГУ / ревизия"
              />
              <button type="submit" className="primary-btn" disabled={busy}>
                Создать модель и гайд
              </button>
            </form>
          ) : null}
          <div className="vmagnitol-grid">
            {(brand.models || []).map((m) => (
              <button key={m.id} type="button" className="vmagnitol-card" onClick={() => openModel(m)}>
                <strong>{m.name}</strong>
                <p className="muted small">
                  {[m.years, m.head_unit].filter(Boolean).join(" · ") || "Без деталей"}
                </p>
              </button>
            ))}
          </div>
          {!(brand.models || []).length ? <p className="muted">У марки пока нет моделей.</p> : null}
        </>
      ) : null}

      {model && guide ? (
        <>
          <div className="vmagnitol-actions" style={{ marginLeft: 0 }}>
            <button type="button" className="ghost-btn" disabled={busy} onClick={onTogglePublish}>
              {guide.status === "published" ? "Снять с публикации" : "Опубликовать"}
            </button>
            <button type="button" className="primary-btn" disabled={busy} onClick={onAddStep}>
              + Шаг
            </button>
          </div>
          <div>
            <h3 style={{ margin: "0 0 6px" }}>{guide.title}</h3>
            {guide.summary ? <p className="muted">{guide.summary}</p> : null}
            {guide.source_url ? (
              <p className="muted small">
                Ориентир:{" "}
                <a href={guide.source_url} target="_blank" rel="noreferrer">
                  внешний источник
                </a>
              </p>
            ) : null}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {(guide.steps || []).map((step) => (
              <article key={step.id} className="vmagnitol-step">
                <div className="vmagnitol-step-head">
                  <span className="vmagnitol-step-num">{step.order}</span>
                  {editingStepId === step.id ? (
                    <input
                      value={stepDraft.title}
                      onChange={(e) => setStepDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                  ) : (
                    <h3>{step.title}</h3>
                  )}
                </div>
                {editingStepId === step.id ? (
                  <>
                    <textarea
                      rows={6}
                      value={stepDraft.body}
                      onChange={(e) => setStepDraft((d) => ({ ...d, body: e.target.value }))}
                      placeholder="Подробная инструкция…"
                    />
                    <textarea
                      rows={2}
                      value={stepDraft.warning}
                      onChange={(e) => setStepDraft((d) => ({ ...d, warning: e.target.value }))}
                      placeholder="Предупреждение (опционально)"
                    />
                    <div className="vmagnitol-actions" style={{ marginLeft: 0 }}>
                      <button type="button" className="primary-btn" disabled={busy} onClick={() => onSaveStep(step.id)}>
                        Сохранить
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => setEditingStepId(null)}>
                        Отмена
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {step.body ? <p className="vmagnitol-step-body">{step.body}</p> : <p className="muted">Текст шага пуст — отредактируйте.</p>}
                    {step.warning ? <p className="vmagnitol-warn">{step.warning}</p> : null}
                    <div className="vmagnitol-actions" style={{ marginLeft: 0 }}>
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          setEditingStepId(step.id);
                          setStepDraft({
                            title: step.title || "",
                            body: step.body || "",
                            warning: step.warning || "",
                          });
                        }}
                      >
                        Править
                      </button>
                      <button type="button" className="ghost-btn" onClick={() => onDeleteStep(step.id)}>
                        Удалить
                      </button>
                      <label className="ghost-btn" style={{ cursor: "pointer" }}>
                        + Файл
                        <input
                          type="file"
                          hidden
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) onUpload(step.id, f);
                          }}
                        />
                      </label>
                    </div>
                  </>
                )}
                {(step.files || []).length ? (
                  <ul className="vmagnitol-files">
                    {step.files.map((f) => (
                      <li key={f.id}>
                        <a href={f.url} target="_blank" rel="noreferrer">
                          {f.title || f.original_name || `Файл #${f.id}`}
                        </a>
                        <span className="muted small">{formatBytes(f.size_bytes)}</span>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={async () => {
                            await deleteFile(authFetch, API_URL, f.id);
                            await openGuide(guide.id);
                          }}
                        >
                          Удалить файл
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
          {!(guide.steps || []).length ? <p className="muted">Шагов пока нет.</p> : null}
        </>
      ) : null}

      {model && !guide ? <p className="muted">У модели нет гайда.</p> : null}
    </section>
  );
}
