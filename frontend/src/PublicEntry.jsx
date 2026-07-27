import App from "./App.jsx";
import CookieConsentBanner from "./CookieConsentBanner.jsx";
import CafeGuestPage from "./CafeGuestPage.jsx";
import BusinessesPage from "./legal/BusinessesPage.jsx";
import ContactsPage from "./legal/ContactsPage.jsx";
import OfferPage from "./legal/OfferPage.jsx";
import PrivacyPage from "./legal/PrivacyPage.jsx";
import PublicOrgPage from "./legal/PublicOrgPage.jsx";

const LEGAL_ROUTES = {
  "/offer": OfferPage,
  "/contacts": ContactsPage,
  "/privacy": PrivacyPage,
  "/businesses": BusinessesPage,
};

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

export default function PublicEntry() {
  const path = normalizePath(window.location.pathname);
  const LegalPage = LEGAL_ROUTES[path];
  const orgMatch = path.match(/^\/o\/([^/]+)$/);
  const tableMatch = path.match(/^\/t\/([^/]+)$/);

  let content = <App />;
  if (LegalPage) content = <LegalPage />;
  else if (orgMatch) content = <PublicOrgPage slug={decodeURIComponent(orgMatch[1])} />;
  else if (tableMatch) content = <CafeGuestPage token={decodeURIComponent(tableMatch[1])} />;

  return (
    <>
      {content}
      <CookieConsentBanner />
    </>
  );
}
