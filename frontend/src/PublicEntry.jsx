import { lazy, Suspense } from "react";
import CookieConsentBanner from "./CookieConsentBanner.jsx";
import CafeGuestPage from "./CafeGuestPage.jsx";
import BusinessesPage from "./legal/BusinessesPage.jsx";
import CityPage from "./legal/CityPage.jsx";
import ContactsPage from "./legal/ContactsPage.jsx";
import NotFoundPage from "./legal/NotFoundPage.jsx";
import OfferPage from "./legal/OfferPage.jsx";
import PrivacyPage from "./legal/PrivacyPage.jsx";
import PublicOrgPage from "./legal/PublicOrgPage.jsx";
import HomeFallback from "./HomeFallback.jsx";
import { viewFromPath } from "./viewRoutes.js";
import "./landing.css";

const App = lazy(() => import("./App.jsx"));

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
    <Suspense fallback={<HomeFallback />}>
      <App />
    </Suspense>
  );
}

export default function PublicEntry() {
  const path = normalizePath(window.location.pathname);
  const LegalPage = LEGAL_ROUTES[path];
  const orgMatch = path.match(/^\/o\/([^/]+)$/);
  const tableMatch = path.match(/^\/t\/([^/]+)$/);
  const menuMatch = path.match(/^\/m\/([^/]+)$/);
  const cityMatch = path.match(/^\/city\/([^/]+)$/);
  const appView = viewFromPath(path);

  let content;
  if (path === "/") content = <LazyApp />;
  else if (LegalPage) content = <LegalPage />;
  else if (orgMatch) content = <PublicOrgPage slug={decodeURIComponent(orgMatch[1])} />;
  else if (tableMatch) content = <CafeGuestPage mode="table" keyId={decodeURIComponent(tableMatch[1])} />;
  else if (menuMatch) content = <CafeGuestPage mode="org" keyId={decodeURIComponent(menuMatch[1])} />;
  else if (cityMatch) content = <CityPage cityKey={decodeURIComponent(cityMatch[1]).toLowerCase()} />;
  else if (appView) content = <LazyApp />;
  else content = <NotFoundPage />;

  return (
    <>
      {content}
      <CookieConsentBanner />
    </>
  );
}
