# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Primary users of the **business cabinet** (this redesign scope):

- **Organization owner / provider** — runs a service business on the platform (hair salon, beauty studio, auto service, cafe/restaurant, marketplace seller, or shop). Starts the day in the booking calendar (or sphere home), configures organization settings, manages staff access.
- **Staff member** — sees a permission-scoped subset of the same chrome (calendar, clients, chats, etc.); may lack organization and full staff-admin pages.

Secondary audiences exist (clients on map/booking, public landing) but are **out of scope** for the current cabinet visual redesign.

## Product Purpose

**Вместе** is a SaaS ecosystem for service businesses and sellers: online booking, service catalog, in-app chats, organization ops, and adjacent apps (Вменю, Вмагазине, cafe floor, marketplaces). Success for the cabinet means the owner or staff can complete daily ops—see and act on bookings, keep org settings correct, invite and permission staff—without leaving the workspace.

## Positioning

One account spans booking, catalog, messaging, and sphere-specific tools (salon calendar, cafe orders, marketplace catalog) instead of disconnected single-purpose apps. Free online booking is a core entry; paid Business plan unlocks deeper automation.

## Operating Context

- Web app (Vite + React) and Capacitor wrappers (Android / iOS) share the same cabinet UI; native shell adds safe-area classes (`native-app`).
- Navigation is view-state driven (`currentView` + `viewRoutes.js`), not a separate router library: chrome (`CabinetChrome`) + subnav bookmarks + overflow menu.
- Sphere defaults change bookmarks (`hair_salon`, `cafe_restaurant`, `marketplaces`, `shops`, `service_center`).
- Typical provider jobs in scope: month calendar → day detail → booking actions; organization settings forms; staff list / invite / permissions.
- Light and dark themes via `data-theme` / `theme-dark`.

## Capabilities and Constraints

Confirmed (cabinet-relevant):

- Bookings calendar, intervals, clients, chats, analytics, reviews, subscriptions, service catalog, shop, sphere workspaces.
- Organization settings and staff management gated by permissions (`canManageOrgSettings`, `canAccessStaffPage`).
- E2E coverage (Playwright) and CI gate before production deploy; redesign must not casually break roles, labels, or selectors relied on by tests.
- Design tokens partially centralized (`styles.css` + `design-kit.css`); large hard-coded orange/cream surface styles remain.

Open / out of scope for this pass:

- Landing, client map, Вменю, Вмагазине visual redesign.
- Logo redesign (asset frozen unless separately approved).

## Brand Commitments

- Product name: **Вместе**.
- Brand accent pinned: **`#FF7A00`** (logo pin, `theme-color`, CSS `--accent`).
- Logo wordmark uses Manrope-weight letterforms + orange map-pin (`frontend/brand-proposals/selected-logo.svg`, `frontend/src/assets/logo-main.png`) — **do not change without an explicit brand decision**.
- Marketing landing already loads Manrope + Source Serif 4; cabinet currently declares Inter — unification is a design-system decision, not a product rename.

## Evidence on Hand

- Live product copy and spheres: `frontend/src/LandingPage.jsx`.
- Cabinet chrome and panels: `CabinetChrome.jsx`, `BookingCalendar.jsx`, `OrganizationSettingsPanel.jsx`, `StaffManagementPanel.jsx`, `GeneralSettingsPanel.jsx`, `ProfileCabinetPanel.jsx`.
- Brand picker / selected assets: `frontend/brand-proposals/`.
- Case-style marketing quotes on the landing are illustrative marketing content; do not invent new customer claims in UI redesign docs.
- No prior `PRODUCT.md` / `DESIGN.md` existed before this capture.

## Product Principles

1. **Ops first in the cabinet** — density, scanability, and clear states beat decorative chrome.
2. **One account, sphere-aware navigation** — same shell, different default jobs by business type.
3. **Brand in signals, not wallpaper** — orange and logo identify Вместе; workspace clarity stays primary.
4. **Permission-honest UI** — hide or gate what the role cannot do; don’t pretend parity.
5. **Ship without breaking the gate** — visual change must remain compatible with existing flows and CI E2E where possible.

## Accessibility & Inclusion

- Existing focus ring tokens (`--vm-focus-ring`) and theme toggle; no separately contracted WCAG level documented.
- Touch / mobile density matters (subnav scroll, bottom-aligned auth modal, Capacitor safe areas). Prefer readable contrast when replacing the cream/peach calendar pastels.
