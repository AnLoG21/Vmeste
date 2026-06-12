import App from "./App.jsx";
import ContactsPage from "./legal/ContactsPage.jsx";
import OfferPage from "./legal/OfferPage.jsx";
import PrivacyPage from "./legal/PrivacyPage.jsx";

const LEGAL_ROUTES = {
  "/offer": OfferPage,
  "/contacts": ContactsPage,
  "/privacy": PrivacyPage,
};

function normalizePath(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path;
}

export default function PublicEntry() {
  const path = normalizePath(window.location.pathname);
  const LegalPage = LEGAL_ROUTES[path];
  if (LegalPage) {
    return <LegalPage />;
  }
  return <App />;
}
