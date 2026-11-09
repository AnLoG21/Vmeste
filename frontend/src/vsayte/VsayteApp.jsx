import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import "./vsayte.css";
import VsayteLogo from "./VsayteLogo.jsx";
import {
  vsayteAttachDomain,
  vsayteCheckDomain,
  vsayteCreateSite,
  vsayteDeleteSite,
  vsayteEntitlement,
  vsayteGetSite,
  vsayteListSites,
  vsaytePublish,
  vsaytePurchaseDomain,
  vsayteUnpublish,
  vsayteUpdateSite,
  vsayteUploadAsset,
} from "./vsayteApi.js";
import { exportSiteHtml, localDeleteSite, localListSites, localSaveSite } from "./vsayteLocal.js";
import { buildTemplateDocument } from "./vsayteTemplates.js";

const VsayteEditor = lazy(() => import("./VsayteEditor.jsx"));

const PLAN_COPY = [
  {
    slug: "vsayte-free",
    name: "Бесплатный",
    price: "0 ₽",
    blurb: "Локальный редактор, базовые шаблоны. Без публикации.",
  },
  {
    slug: "vsayte-hosting",
    name: "Хостинг",
    price: "300 ₽/мес",
    blurb: "Публикация на поддомене *.vsayte.vsevmeste.space.",
  },
  {
    slug: "vsayte-pro",
    name: "Pro",
    price: "990 ₽/мес",
    blurb: "Полный конструктор, все шрифты и свой домен через REG.RU.",
  },
];

export default function VsayteApp({ authFetch, API_URL, me, onExit }) {
  const [tab, setTab] = useState("sites"); // sites | plans | editor
  const [entitlement, setEntitlement] = useState(null);
  const [sites, setSites] = useState([]);
  const [localSites, setLocalSites] = useState([]);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null); // { id, local?, title, document, ... }
  const [draftDoc, setDraftDoc] = useState(null);
  const [domainInput, setDomainInput] = useState("");
  const [domainInfo, setDomainInfo] = useState(null);

  const editorTier = entitlement?.editor_tier || "basic";
  const canPublish = Boolean(entitlement?.can_publish);
  const canCustomDomain = Boolean(entitlement?.can_custom_domain);
  const baseDomain = entitlement?.base_domain || "vsayte.vsevmeste.space";

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [ent, list, local, plansRes] = await Promise.all([
        vsayteEntitlement(authFetch, API_URL),
        vsayteListSites(authFetch, API_URL),
        localListSites(),
        authFetch(`${API_URL}/subscriptions/plans/`).then((r) => r.json()),
      ]);
      setEntitlement(ent);
      setSites(Array.isArray(list) ? list : []);
      setLocalSites(Array.isArray(local) ? local : []);
      const vsaytePlans = (Array.isArray(plansRes) ? plansRes : []).filter(
        (p) => p.product_kind === "vsayte" || String(p.slug || "").startsWith("vsayte-"),
      );
      setPlans(vsaytePlans);
    } catch (e) {
      setError(e.message || "Не удалось загрузить Всайте");
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const currentPlanSlug = entitlement?.limits?.plan_slug || "vsayte-free";

  async function payPlan(planId) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await authFetch(`${API_URL}/subscriptions/pay/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Оплата не удалась");
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url;
        return;
      }
      setMessage(data.detail || "Тариф активирован");
      await refresh();
    } catch (e) {
      setError(e.message || "Ошибка оплаты");
    } finally {
      setBusy(false);
    }
  }

  async function createSite({ localOnly = false } = {}) {
    setBusy(true);
    setError("");
    try {
      const doc = buildTemplateDocument("landing", "orange", "manrope", editorTier);
      if (localOnly) {
        const saved = await localSaveSite({
          title: "Локальный сайт",
          document: doc,
          template_id: "landing",
        });
        openEditor(saved);
        await refresh();
        return;
      }
      const site = await vsayteCreateSite(authFetch, API_URL, {
        title: "Новый сайт",
        document: doc,
        template_id: "landing",
      });
      openEditor(site);
      await refresh();
    } catch (e) {
      setError(e.message || "Не удалось создать сайт");
    } finally {
      setBusy(false);
    }
  }

  function openEditor(site) {
    setEditing(site);
    setDraftDoc(site.document || {});
    setTab("editor");
    setDomainInput("");
    setDomainInfo(null);
  }

  async function openRemoteEditor(id) {
    setBusy(true);
    try {
      const site = await vsayteGetSite(authFetch, API_URL, id);
      openEditor(site);
    } catch (e) {
      setError(e.message || "Не удалось открыть сайт");
    } finally {
      setBusy(false);
    }
  }

  async function saveEditing() {
    if (!editing || !draftDoc) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (editing.local || String(editing.id).startsWith("local-")) {
        const saved = await localSaveSite({
          ...editing,
          title: editing.title || "Локальный сайт",
          document: draftDoc,
        });
        setEditing(saved);
        setMessage("Сохранено локально");
      } else {
        const updated = await vsayteUpdateSite(authFetch, API_URL, editing.id, {
          title: editing.title,
          document: draftDoc,
        });
        setEditing(updated);
        setMessage("Сохранено");
      }
      await refresh();
    } catch (e) {
      setError(e.message || "Ошибка сохранения");
    } finally {
      setBusy(false);
    }
  }

  async function publishEditing() {
    if (!editing || editing.local) {
      setError("Сначала сохраните сайт на сервер (тариф Хостинг или Pro).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await vsayteUpdateSite(authFetch, API_URL, editing.id, { document: draftDoc });
      const published = await vsaytePublish(authFetch, API_URL, editing.id);
      setEditing(published);
      setMessage(published.publish?.url ? `Опубликовано: ${published.publish.url}` : "Опубликовано");
      await refresh();
    } catch (e) {
      setError(e.message || "Публикация недоступна");
    } finally {
      setBusy(false);
    }
  }

  async function unpublishEditing() {
    if (!editing || editing.local) return;
    setBusy(true);
    try {
      const updated = await vsayteUnpublish(authFetch, API_URL, editing.id);
      setEditing(updated);
      setMessage("Сайт снят с публикации");
      await refresh();
    } catch (e) {
      setError(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function removeSite(site) {
    if (!window.confirm(`Удалить «${site.title}»?`)) return;
    setBusy(true);
    try {
      if (site.local || String(site.id).startsWith("local-")) {
        await localDeleteSite(site.id);
      } else {
        await vsayteDeleteSite(authFetch, API_URL, site.id);
      }
      if (editing && editing.id === site.id) {
        setEditing(null);
        setTab("sites");
      }
      await refresh();
    } catch (e) {
      setError(e.message || "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  function downloadLocalHtml() {
    if (!draftDoc) return;
    const html = exportSiteHtml(draftDoc, editing?.title || "Сайт");
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${editing?.slug || editing?.title || "site"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onUploadAsset(file) {
    if (!editing) return null;
    // Локальный сайт — data URL; серверный — API (если лимит тарифа).
    if (editing.local || String(editing.id).startsWith("local-")) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
        reader.readAsDataURL(file);
      });
      return {
        src: dataUrl,
        name: file.name || "file",
        type: file.type || "image",
      };
    }
    setBusy(true);
    try {
      const asset = await vsayteUploadAsset(authFetch, API_URL, editing.id, file);
      setMessage("Файл загружен — можно применить к блоку на холсте");
      return {
        src: asset.url,
        name: asset.original_name || file.name || "file",
        type: asset.content_type || file.type || "image",
      };
    } catch (e) {
      setError(e.message || "Ошибка загрузки");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function checkDomain() {
    setBusy(true);
    setDomainInfo(null);
    try {
      const info = await vsayteCheckDomain(authFetch, API_URL, domainInput);
      setDomainInfo(info);
    } catch (e) {
      setError(e.message || "Проверка не удалась");
    } finally {
      setBusy(false);
    }
  }

  async function buyDomain() {
    if (!editing || editing.local) return;
    setBusy(true);
    try {
      const res = await vsaytePurchaseDomain(authFetch, API_URL, editing.id, domainInput);
      setMessage(res.registration?.detail || "Домен оформлен");
      setEditing(await vsayteGetSite(authFetch, API_URL, editing.id));
      await refresh();
    } catch (e) {
      setError(e.message || "Покупка домена не удалась");
    } finally {
      setBusy(false);
    }
  }

  async function attachDomain() {
    if (!editing || editing.local) return;
    setBusy(true);
    try {
      await vsayteAttachDomain(authFetch, API_URL, editing.id, domainInput);
      setMessage("Домен привязан. Укажите A-запись на IP сервера.");
      setEditing(await vsayteGetSite(authFetch, API_URL, editing.id));
      await refresh();
    } catch (e) {
      setError(e.message || "Не удалось привязать домен");
    } finally {
      setBusy(false);
    }
  }

  const planCards = useMemo(() => {
    return PLAN_COPY.map((copy) => {
      const apiPlan = plans.find((p) => p.slug === copy.slug);
      return { ...copy, apiPlan };
    });
  }, [plans]);

  if (tab === "editor" && editing) {
    return (
      <section className="vsayte-app vsayte-app--editor">
        <button
          type="button"
          className="vsayte-back"
          aria-label="Назад к списку сайтов"
          title="Назад"
          onClick={() => { setTab("sites"); setEditing(null); }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5L8 12l7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="vsayte-head">
          <div className="vsayte-head-brand">
            <VsayteLogo size={32} />
            <div>
              <input
                className="vsayte-select vsayte-title-input"
                value={editing.title || ""}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                aria-label="Название сайта"
                placeholder="Название сайта"
              />
              <div className="muted small">
                {editing.local
                  ? "Локальный режим — без публикации в интернет"
                  : editing.public_url || `Адрес: ${editing.slug}.${baseDomain}`}
              </div>
            </div>
          </div>
          <div className="vsayte-editor-toolbar">
            <button type="button" className="ghost-btn" disabled={busy} onClick={saveEditing}>
              Сохранить
            </button>
            {canPublish && !editing.local ? (
              <>
                <button type="button" className="primary-btn" disabled={busy} onClick={publishEditing}>
                  Опубликовать
                </button>
                {editing.status === "published" ? (
                  <button type="button" className="ghost-btn" disabled={busy} onClick={unpublishEditing}>
                    Снять с публикации
                  </button>
                ) : null}
              </>
            ) : (
              <button type="button" className="ghost-btn" onClick={downloadLocalHtml}>
                Скачать HTML
              </button>
            )}
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        <Suspense fallback={<p className="muted">Загрузка конструктора…</p>}>
          <VsayteEditor
            key={editing.id}
            initialDocument={editing.document || draftDoc}
            editorTier={editorTier}
            onChange={setDraftDoc}
            onUploadFile={onUploadAsset}
          />
        </Suspense>

        {canCustomDomain && !editing.local ? (
          <div className="vsayte-domain-panel">
            <h4>Свой домен (тариф Pro)</h4>
            <div className="vsayte-domain-box">
              <input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="например site.ru"
                aria-label="Имя домена"
              />
              <button type="button" className="ghost-btn" disabled={busy} onClick={checkDomain}>
                Проверить
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={buyDomain}>
                Купить через REG.RU
              </button>
              <button type="button" className="ghost-btn" disabled={busy} onClick={attachDomain}>
                Привязать свой
              </button>
            </div>
            {domainInfo ? (
              <p className="muted small">
                {domainInfo.available ? "Домен свободен" : "Домен занят или недоступен"}
                {domainInfo.price ? ` · ${domainInfo.price} ${domainInfo.currency || ""}` : ""}
                {domainInfo.mock ? " · тестовый режим без ключей REG.RU" : ""}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card vsayte-app">
      <div className="vsayte-head">
        <div className="vsayte-head-brand">
          <VsayteLogo size={44} />
          <div>
            <h2>Всайте</h2>
            <p className="muted small" style={{ margin: 0 }}>
              Конструктор сайтов, хостинг и домены
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="vsayte-plan-pill">{entitlement?.limits?.plan_name || "…"}</span>
          {onExit ? (
            <button type="button" className="ghost-btn" onClick={onExit}>
              К сервисам
            </button>
          ) : null}
        </div>
      </div>

      <div className="vsayte-tabs">
        <button type="button" className={`ghost-btn ${tab === "sites" ? "is-active" : ""}`} onClick={() => setTab("sites")}>
          Мои сайты
        </button>
        <button type="button" className={`ghost-btn ${tab === "plans" ? "is-active" : ""}`} onClick={() => setTab("plans")}>
          Тарифы
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="muted">{message}</p> : null}

      {tab === "sites" ? (
        <>
          <div className="vsayte-site-actions">
            <button type="button" className="primary-btn" disabled={busy} onClick={() => createSite({ localOnly: false })}>
              + Новый сайт
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => createSite({ localOnly: true })}>
              Локальный черновик
            </button>
          </div>

          <h3>На сервере</h3>
          {sites.length === 0 ? <p className="muted">Пока нет сайтов на сервере.</p> : null}
          <div className="vsayte-sites-grid">
            {sites.map((site) => (
              <article key={site.id} className="vsayte-site-card">
                <h3>{site.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  {site.status === "published" ? site.public_url || `https://${site.slug}.${baseDomain}` : "Черновик"}
                </p>
                <div className="vsayte-site-actions">
                  <button type="button" className="ghost-btn small" onClick={() => openRemoteEditor(site.id)}>
                    Редактор
                  </button>
                  <button type="button" className="ghost-btn small" onClick={() => removeSite(site)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>

          <h3>Локально на этом устройстве</h3>
          {localSites.length === 0 ? <p className="muted">Локальных черновиков нет.</p> : null}
          <div className="vsayte-sites-grid">
            {localSites.map((site) => (
              <article key={site.id} className="vsayte-site-card">
                <h3>{site.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>
                  Только на этом браузере
                </p>
                <div className="vsayte-site-actions">
                  <button type="button" className="ghost-btn small" onClick={() => openEditor(site)}>
                    Редактор
                  </button>
                  <button type="button" className="ghost-btn small" onClick={() => removeSite(site)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {tab === "plans" ? (
        <div className="vsayte-plans">
          {planCards.map((p) => (
            <article key={p.slug} className={`vsayte-plan-card ${currentPlanSlug === p.slug ? "is-current" : ""}`}>
              <strong>{p.name}</strong>
              <div className="price">{p.apiPlan ? `${p.apiPlan.price_monthly} ₽` : p.price}</div>
              <p className="muted small">{p.blurb}</p>
              {p.apiPlan?.features?.length ? (
                <ul>
                  {p.apiPlan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
              {currentPlanSlug === p.slug ? (
                <button type="button" className="ghost-btn" disabled>
                  Текущий
                </button>
              ) : p.slug === "vsayte-free" ? (
                <button type="button" className="ghost-btn" disabled={busy} onClick={refresh}>
                  Бесплатно
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-btn"
                  disabled={busy || !p.apiPlan}
                  onClick={() => p.apiPlan && payPlan(p.apiPlan.id)}
                >
                  Оформить
                </button>
              )}
            </article>
          ))}
          <p className="muted small">
            Тарифы Всайте отдельны от «Бизнес» платформы. Пользователь: {me?.email || me?.id || "—"}.
          </p>
        </div>
      ) : null}
    </section>
  );
}
