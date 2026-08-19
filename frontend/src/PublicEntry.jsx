import { Component, lazy, Suspense } from "react";
import CookieConsentBanner from "./CookieConsentBanner.jsx";
import CafeGuestPage from "./CafeGuestPage.jsx";
import { InspectionPublicPage } from "./InspectionApproveView.jsx";
import BusinessesPage from "./legal/BusinessesPage.jsx";
import CityPage from "./legal/CityPage.jsx";
import ContactsPage from "./legal/ContactsPage.jsx";
import NotFoundPage from "./legal/NotFoundPage.jsx";
import OfferPage from "./legal/OfferPage.jsx";
import PrivacyPage from "./legal/PrivacyPage.jsx";
import PublicOrgPage from "./legal/PublicOrgPage.jsx";
import HomeFallback from "./HomeFallback.jsx";
import { shouldLoadApp } from "./viewRoutes.js";
import "./landing.css";

function lazyAppImport() {
  return import("./App.jsx").catch((err) => {
    console.error("App chunk load failed", err);
    return {
      default: function AppLoadError() {
        return (
          <main className="landing page page--guest" style={{ padding: "2rem 1.25rem" }}>
            <h1>Не удалось загрузить приложение</h1>
            <p className="landing-hero-lead">
              Обновите страницу (Ctrl+F5). Если ошибка повторяется — подождите минуту после деплоя.
            </p>
            <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
              Обновить
            </button>
          </main>
        );
      },
    };
  });
}

const App = lazy(lazyAppImport);

class AppChunkErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="landing page page--guest" style={{ padding: "2rem 1.25rem" }}>
          <h1>Ошибка интерфейса</h1>
          <p className="landing-hero-lead">Попробуйте обновить страницу.</p>
          <button type="button" className="primary-btn" onClick={() => window.location.reload()}>
            Обновить
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

const LEGAL_ROUTES = {
  "/offer": OfferPage,
  "/contacts": ContactsPage,
  "/privacy": PrivacyPage,
  "/businesses": BusinessesPage,
};

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function LazyApp() {
  return (
    <AppChunkErrorBoundary>
      <Suspense fallback={<HomeFallback />}>
        <App />
      </Suspense>
    </AppChunkErrorBoundary>
  );
}

export default function PublicEntry() {
  const path = normalizePath(window.location.pathname);
  const LegalPage = LEGAL_ROUTES[path];
  const orgMatch = path.match(/^\/o\/([^/]+)$/);
  const tableMatch = path.match(/^\/t\/([^/]+)$/);
  const menuMatch = path.match(/^\/m\/([^/]+)$/);
  const inspectionMatch = path.match(/^\/i\/([^/]+)$/);
  const cityMatch = path.match(/^\/city\/([^/]+)$/);
  const appView = shouldLoadApp(path);

  let content;
  if (appView) content = <LazyApp />;
  else if (LegalPage) content = <LegalPage />;
  else if (orgMatch) content = <PublicOrgPage slug={decodeURIComponent(orgMatch[1])} />;
  else if (inspectionMatch) content = <InspectionPublicPage token={decodeURIComponent(inspectionMatch[1])} />;
  else if (tableMatch) content = <CafeGuestPage mode="table" keyId={decodeURIComponent(tableMatch[1])} />;
  else if (menuMatch) content = <CafeGuestPage mode="org" keyId={decodeURIComponent(menuMatch[1])} />;
  else if (cityMatch) content = <CityPage cityKey={decodeURIComponent(cityMatch[1]).toLowerCase()} />;
  else content = <NotFoundPage />;

  return (
    <>
      {content}
      <CookieConsentBanner />
    </>
  );
}
