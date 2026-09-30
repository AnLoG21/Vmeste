---
name: Вместе (cabinet target)
description: Locked redesign world — Merchant Calendar Pad for the business cabinet (Operate).
status: target-locked
lockedOptionId: challenger-calendar-pad
buildPath: code
scope: business-cabinet
colors:
  pad-board: "#FFF3E8"
  ink-brown: "#1A1208"
  brand-orange: "#FF7A00"
  orange-rule: "#FFBF8A"
  warm-chrome: "#FFF8F2"
  surface-white: "#FFFFFF"
  mute-copper: "#8D5A2B"
  hairline: "#FFE0C7"
  today-ring: "#FF7A00"
  past-quiet: "#F3DCC8"
typography:
  ui:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: "1.4"
  title:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: "1.25"
  pad-month:
    fontFamily: "Manrope, Segoe UI, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: "1.2"
    letterSpacing: "0.06em"
rounded:
  sm: "6px"
  md: "10px"
  sheet: "4px"
  none: "0px"
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
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
  calendar-pad:
    backgroundColor: "{colors.pad-board}"
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.md}"
    padding: "16px"
  chrome-bar:
    backgroundColor: "{colors.warm-chrome}"
    textColor: "{colors.ink-brown}"
    padding: "12px 24px"
  subnav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.mute-copper}"
    rounded: "{rounded.sheet}"
    padding: "8px 12px"
  subnav-tab-active:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-brown}"
    rounded: "{rounded.sheet}"
---

# Design System: Вместе — Business Cabinet (target)

> **Locked direction:** Merchant Calendar Pad (`challenger-calendar-pad`), code-led.  
> **Incumbent baseline archived at** [`DESIGN.incumbent.md`](DESIGN.incumbent.md).  
> **Brand pins:** name Вместе, accent `#FF7A00`, existing logo assets unchanged.

## Overview

**Creative North Star: "Merchant Calendar Pad"**

The cabinet is a print-shop wall calendar brought into ops software: a quiet Together mark sits above a tear-off date pad that is the primary instrument. The whole cabinet stays in the Вместе orange family: warm peach chrome, a slightly deeper peach pad, and thin orange rules instead of heavy borders. Orange is the merchant stamp — today ring, primary actions, active tab — spent rarely.

Key characteristics:

- Calendar pad is the hero surface; chrome is subordinate
- Manrope unifies cabinet with brand/landing type
- Warm peach chrome + deeper peach pad, in the brand orange family
- Tear-off metaphor for day-detail (modal/sheet), not decorative motion
- Monochrome icons; status as text line, not rainbow

## Colors

### Primary

- **Brand Orange** (`#FF7A00`): CTA, today ring, active bookmark underline/stamp only.

### Neutral

- **Pad Board** (`#FFF3E8`): calendar plate, a step deeper than the chrome.
- **Warm Chrome** (`#FFF8F2`): header, subnav track, page outside the pad.
- **Surface White** (`#FFFFFF`): settings/staff forms, modals.
- **Ink Brown** (`#1A1208`): primary text (matches logo ink).
- **Orange Rule** (`#FFBF8A`): 1px separators under titles and the subnav.
- **Mute Copper** (`#8D5A2B`): secondary labels.
- **Past Quiet** (`#F3DCC8`): past days on the pad.

### Named Rules

**The Orange Family Rule.** Chrome, pad, and rules all come from the brand orange ramp; no cool grays or gold.

**The One Stamp Rule.** Orange appears on ≤3 roles per screen: primary button, today, active nav. Never borders-of-everything.

**The Thin Rule Rule.** Orange rules are 1px hairlines, never heavy borders.

## Typography

**UI Font:** Manrope (already loaded for landing)  
**No Inter in cabinet target.**

### Hierarchy

- **Title** (700, 1.25rem): panel titles.
- **UI** (500, 15px): body/forms.
- **Pad month** (700, 12px, tracked caps sparingly for month name only — the one place condensed caps earn their keep on a calendar pad).

## Layout

- Header: logo left, overflow menu right, optional status line under mark.
- Subnav: tab row on warm chrome; active tab is soft peach with an orange underline.
- Bookings: pad owns the main column full width; day-detail as tear-off sheet/modal.
- Settings / staff: centered white forms (max ~920px), orange hairline under titles.

## Elevation & Depth

Flat pad with hairline orange rule; soft shadow only on tear-off day sheet. No multi-layer SaaS card stack.

## Shapes

Tighter radii (6–10px). Prefer sheet corners on the pad over 999px pills. Subnav tabs slightly squared.

## Components

### Chrome

Warm bar, single-color copper icons, status line for shift state.

### Calendar pad

Board fill, month label, even date grid, today = printed orange ring, past days quieter, weekends via type weight/ink — not peach gradients.

### Settings & staff

White forms, ink labels, orange primary save, ghost secondary with ink/hairline.

### Modal / tear-off

Day detail enters as a sheet torn from the pad (short transform optional, 150–200ms, reduced-motion: instant).

## Do's and Don'ts

**Do**

- Keep `#FF7A00` and logo.
- Keep chrome and pad in the orange family.
- Prefer tokens in `design-kit.css` / CSS vars; migrate hard-coded peach hex away on touched files.
- Preserve E2E-facing labels and roles.

**Don't**

- Recreate peach page (`#fff8f2`) + peach borders everywhere.
- Rainbow Material icon colors.
- Inter as cabinet face.
- Expand redesign to landing/client/Вменю in the pilot.

## Cross-surface reach

Pilot order: chrome → calendar → organization/settings → staff. Other spheres inherit tokens once chrome+calendar land.
