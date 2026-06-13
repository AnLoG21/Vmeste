import { Suspense, lazy } from "react";

const App = lazy(() => import("./App.jsx"));
const ContactsPage = lazy(() => import("./legal/ContactsPage.jsx"));
const OfferPage = lazy(() => import("./legal/OfferPage.jsx"));
const PrivacyPage = lazy(() => import("./legal/PrivacyPage.jsx"));

const LEGAL_ROUTES = {
  "/offer": OfferPage,
  "/contacts": ContactsPage,
  "/privacy": PrivacyPage,
};

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path;
}

function PageFallback() {
  return null;
}

export default function PublicEntry() {
  const path = normalizePath(window.location.pathname);
  const LegalPage = LEGAL_ROUTES[path];
  if (LegalPage) {
    return (
      <Suspense fallback={<PageFallback />}>
        <LegalPage />
      </Suspense>
    );
  }
  return (
    <Suspense fallback={<PageFallback />}>
      <App />
    </Suspense>
  );
}
