import App from "./App.jsx";
import CookieConsentBanner from "./CookieConsentBanner.jsx";
import BusinessesPage from "./legal/BusinessesPage.jsx";
import ContactsPage from "./legal/ContactsPage.jsx";
import OfferPage from "./legal/OfferPage.jsx";
import PrivacyPage from "./legal/PrivacyPage.jsx";

const LEGAL_ROUTES = {
  "/offer": OfferPage,
  "/contacts": ContactsPage,
  "/privacy": PrivacyPage,
  "/businesses": BusinessesPage,
};

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path;
}

export default function PublicEntry() {
  const path = normalizePath(window.location.pathname);
  const LegalPage = LEGAL_ROUTES[path];
  return (
    <>
      {LegalPage ? <LegalPage /> : <App />}
      <CookieConsentBanner />
    </>
  );
}
