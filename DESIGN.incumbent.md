---
name: Вместе (cabinet incumbent)
description: Pre-redesign capture of the business cabinet visual system — warm peach ops shell with orange brand accent.
status: incumbent-pre-redesign
scope: business-cabinet
colors:
  peach-page: "#fff8f2"
  card-white: "#ffffff"
  ink: "#1a1a1a"
  muted-gray: "#8d8d8d"
  peach-border: "#ffd9bd"
  brand-orange: "#ff7a00"
  brand-orange-hover: "#eb6f00"
  copper-text: "#8d3e00"
  deep-copper: "#5a2800"
  peach-soft: "#fff3e8"
  peach-active: "#ffe8d5"
  peach-chip-border: "#ffbf8a"
  calendar-cell: "#fffdfb"
  weekend-peach: "#ffe8d4"
  danger: "#b91c1c"
  dark-page: "#0f0f10"
  dark-card: "#1a1b1e"
  dark-ink: "#ececec"
  dark-border: "#2e3038"
  dark-accent: "#ff8c33"
typography:
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: "1.45"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: "1.3"
  label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "1.35"
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "24px"
  6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.brand-orange-hover}"
    textColor: "#ffffff"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#c85a00"
    rounded: "{rounded.sm}"
    padding: "0 16px"
  card-workspace:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  subnav-pill:
    backgroundColor: "transparent"
    textColor: "{colors.copper-text}"
    rounded: "{rounded.pill}"
    padding: "8px 14px"
  subnav-pill-active:
    backgroundColor: "{colors.peach-active}"
    textColor: "{colors.deep-copper}"
    rounded: "{rounded.pill}"
  modal-card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
    width: "min(520px, 92vw)"
  calendar-cell:
    backgroundColor: "{colors.calendar-cell}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "6px"
---

# Design System: Вместе — Business Cabinet (incumbent)

> **Status: incumbent / pre-redesign.** This file documents the visual system **as shipped today** for the business cabinet (chrome, calendar, organization settings, staff). It is the baseline for a replacement visual world — not the target after redesign. Brand pins that survive redesign: product name **Вместе**, accent **`#FF7A00`**, existing logo assets.

## Overview

**Creative North Star: "Warm Peach Ops Desk"**

The cabinet is a peach-tinted operational shell: page background, borders, subnav, and calendar weekends all sit in the same warm orange family as the brand pin. Surfaces are white cards with soft peach borders; primary actions are solid brand orange. Density is moderate — calendar cells are tall (`min-height: 150px`), settings and staff live in centered single-column cards (~920–1040px). Personality reads friendly and small-business, closer to a marketing landing warmth than to a dense scheduling instrument.

Key characteristics:

- Single accent family (orange/peach) used for page chrome, borders, and CTA
- Inter declared for cabinet UI (landing separately uses Manrope + Source Serif 4)
- Pill subnav + multicolored Material-style menu icons
- Dual token layers: CSS vars in `styles.css` / `design-kit.css`, plus widespread hard-coded hex in legacy rules
- Light/dark themes; dark calendar cells intentionally keep warm light cell fills

**Anti-reference for redesign (do not polish in place):** peach page as wallpaper, rainbow menu icons, weekend gradient pastels, Inter-as-default when brand already ships Manrope.

## Colors

Warm peach neutrals + one brand orange. Almost no cool neutrals on light theme.

### Primary

- **Brand Orange** (`#ff7a00` / hover `#eb6f00`): CTAs, today marker, selected outlines, focus ring tint, logo pin. Dark theme accent `#ff8c33`.

### Neutral

- **Peach Page** (`#fff8f2`): logged-in page background (`--bg-page`).
- **Card White** (`#ffffff`): panels, modals (`--bg-card`).
- **Peach Border** (`#ffd9bd`): cards, subnav rule, modal border (`--border`).
- **Ink** (`#1a1a1a`) / **Muted** (`#8d8d8d`): body and secondary text.
- **Copper Text** (`#8d3e00` / active `#5a2800`): subnav labels and status hints.
- **Peach Soft / Active** (`#fff3e8` / `#ffe8d5`): hover fills and active pills.
- **Dark Page / Card** (`#0f0f10` / `#1a1b1e`): dark theme canvas.

### Semantic

- **Danger** (`#b91c1c` / `#c62828`): destructive actions, logout icon tint.
- Success / info appear as one-off hex in icons and badges (e.g. green map pin `#2e7d32`, blue bookings `#1565c0`) — not a coherent secondary system.

### Named Rules

**The One Family Rule (incumbent).** Borders, fills, and accent are the same peach-orange family; cool gray workspace surfaces are rare on light theme.

**The Accent Everywhere Rule (anti-pattern to replace).** Brand orange and peach tints color chrome, calendar weekends, and marketing warmth simultaneously — rarity is not preserved.

## Typography

**Display Font:** Inter (system fallbacks) — also used as `--vm-font-display`  
**Body Font:** Inter (system fallbacks)  
**Brand/marketing (adjacent, not cabinet):** Manrope + Source Serif 4 on landing (`index.html`)

**Character:** Neutral SaaS sans; no distinctive display voice inside the cabinet. Hierarchy is mostly weight (600–800) and size, not family contrast.

### Hierarchy

- **Title** (700, ~1.35rem): panel `h2` / `.vm-title`.
- **Body** (400, 14–16px, ~1.45): forms, lists, calendar event lines.
- **Label** (600, 13–14px): subnav pills, checkboxes, muted field labels.
- **Calendar day** (700–800): day number; today uses pill badge on orange.

### Named Rules

**The Landing Split Rule.** Marketing already committed to Manrope; cabinet still declares Inter — treat as drift, not intentional dual-branding, when redesigning.

## Layout

- **Page shell:** `.page` max-width `1480px`, padding `24px`; logged-in header is `hero.top-row` grid `auto 1fr auto` (logo | optional search | menu).
- **Subnav:** full-bleed peach bar under header; horizontal pills; scrolls when bookmarks > 4.
- **Main grid:** two columns default; one column ≤860px. Settings/org/staff/profile use `.grid-centered-workspace` (max 920px, profile-wide 1040px).
- **Calendar:** full-width card; 7-column grid; tall cells.
- **Spacing rhythm:** design-kit 4–32px scale; many legacy rules use 6/8/10/12/14/16 ad hoc.
- **Native:** `mobile.css` + `html.native-app` safe-area vars for Capacitor.

## Elevation & Depth

Mostly **flat with light ambient shadow**. Cards and kit panels use soft drop shadows; calendar weekends add inset peach glow; today uses inset orange ring. Modals sit on `rgba(0,0,0,.35)` scrim. Depth is quiet — borders do more work than shadows.

### Shadow Vocabulary

- **Card / panel** (`0 8px 24px rgba(0,0,0,.08)` light; darker in dark theme via `--vm-shadow`).
- **Primary CTA** (`0 4px 14px rgba(255,122,0,.28)` on some landing/cabinet buttons).
- **Focus** (`0 0 0 3px rgba(255,122,0,.35)` — `--vm-focus-ring`).

## Shapes

- **sm 8px:** inputs, calendar cells, small controls.
- **md 12px:** cards, modals (dominant cabinet radius).
- **lg 18px:** larger kit panels / occasional chips.
- **pill 999px:** subnav buttons, today day badge.

Form language: rounded rectangles + heavy use of pills for navigation chips.

## Components

### Cabinet chrome

- Logo (`logo-main.png`) left; overflow `.menu-dropdown` with per-item multicolored SVG icons.
- Demo banner / toasts below header when relevant.

### Subnav pills

Transparent → peach hover → peach-active with chip border. Labels from `subnavBookmarks.js` / sphere defaults.

### Workspace card

`section.card` / `.profile-card`: white, peach border, 12px radius, 16px padding. Org/settings/staff stack forms, checkboxes, ghost buttons.

### Booking calendar

Month control + `.calendar-grid`. States: empty, weekend gradient, today ring + orange day pill, selected outline, has-items. Day click → day-detail modal.

### Staff

List/table-like rows in cards; invite wizard; permission toggles; deactivate confirmations (E2E-sensitive copy).

### Buttons

- **Primary:** orange fill, white text (global `button` / `.vm-btn--primary`).
- **Ghost:** transparent, copper text, peach border (`.ghost-btn`).
- **Danger:** red fill (`.danger-btn`).

### Modal

`.modal-backdrop` + `.modal-card` (~520px). Variants for overlays/chats exist; pattern is centered card on dim scrim (auth may bottom-sheet on mobile).

## Do's and Don'ts

**Do**

- Prefer CSS variables (`--bg-page`, `--accent`, `--vm-*`) for new cabinet UI.
- Keep brand orange `#FF7A00` as the interactive signal.
- Preserve permission-gated navigation and existing control labels used by E2E.
- Design light and dark together (dark calendar cells already special-cased).

**Don't**

- Treat this peach-wallpaper system as the redesign target — it is the incumbent baseline.
- Introduce a second competing accent family without a system decision.
- Rely on rainbow icon colors for information scent long-term.
- Invent new customer claims or change the logo wordmark in CSS-only passes.
- Expand scope to landing / client map / Вменю / Вмагазине in the cabinet redesign pilot.

## Source map

| Concern | Primary files |
| --- | --- |
| Tokens | `frontend/src/styles.css` (`:root` ~2130), `frontend/src/design-kit.css` |
| Chrome | `frontend/src/CabinetChrome.jsx` |
| Calendar | `frontend/src/BookingCalendar.jsx` |
| Org / settings | `frontend/src/OrganizationSettingsPanel.jsx`, `GeneralSettingsPanel.jsx` |
| Staff | `frontend/src/StaffManagementPanel.jsx` |
| Mobile / native | `frontend/src/mobile.css` |
| Brand assets | `frontend/brand-proposals/selected-logo.svg`, `frontend/src/assets/logo-main.png` |
