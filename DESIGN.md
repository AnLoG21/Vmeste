---
name: Вместе (cabinet target)
description: Locked redesign world — Merchant Calendar Pad for the business cabinet (Operate).
status: target-locked
lockedOptionId: challenger-calendar-pad
buildPath: code
scope: business-cabinet
colors:
  pad-board: "#F7F3EA"
  ink-brown: "#1A1208"
  brand-orange: "#FF7A00"
  gold-rule: "#C4A574"
  cool-chrome: "#F3F4F6"
  surface-white: "#FFFFFF"
  mute-stone: "#6B6560"
  hairline: "#E5E0D6"
  today-ring: "#FF7A00"
  past-quiet: "#D9D2C5"
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
    backgroundColor: "{colors.cool-chrome}"
    textColor: "{colors.ink-brown}"
    padding: "12px 24px"
  subnav-tab:
    backgroundColor: "transparent"
    textColor: "{colors.mute-stone}"
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

The cabinet is a print-shop wall calendar brought into ops software: a quiet Together mark sits above a tear-off date pad that is the primary instrument. The pad carries warm board tone; the surrounding chrome stays cool and spare so the product does not drown in cream. Gold is a thin rule, not a wash. Orange is the merchant stamp — today ring, primary actions, active tab — spent rarely.

Key characteristics:

- Calendar pad is the hero surface; chrome is subordinate
- Manrope unifies cabinet with brand/landing type
- Cool gray chrome + warm pad board (deliberate split against incumbent peach-everything)
- Tear-off metaphor for day-detail (modal/sheet), not decorative motion
- Monochrome icons; status as text line, not rainbow

## Colors

### Primary

- **Brand Orange** (`#FF7A00`): CTA, today ring, active bookmark underline/stamp only.

### Neutral

- **Pad Board** (`#F7F3EA`): calendar plate only — not full page wallpaper.
- **Cool Chrome** (`#F3F4F6`): header, subnav track, page outside the pad.
- **Surface White** (`#FFFFFF`): settings/staff forms, modals.
- **Ink Brown** (`#1A1208`): primary text (matches logo ink).
- **Gold Rule** (`#C4A574`): 1px separators between mark and pad, section rules.
- **Mute Stone** (`#6B6560`): secondary labels.
- **Past Quiet** (`#D9D2C5`): past days on the pad.

### Named Rules

**The Pad Not Wallpaper Rule.** Warm board tone lives on the calendar pad component. Page chrome stays cool gray/white.

**The One Stamp Rule.** Orange appears on ≤3 roles per screen: primary button, today, active nav. Never borders-of-everything.

**The Thin Gold Rule.** Gold is a hairline, never a fill.

## Typography

**UI Font:** Manrope (already loaded for landing)  
**No Inter in cabinet target.**

### Hierarchy

- **Title** (700, 1.25rem): panel titles.
- **UI** (500, 15px): body/forms.
- **Pad month** (700, 12px, tracked caps sparingly for month name only — the one place condensed caps earn their keep on a calendar pad).

## Layout

- Header: logo left, overflow menu right, optional status line under mark.
- Subnav: clip/tab row on cool chrome — not peach pills.
- Bookings: pad owns the main column full width; day-detail as tear-off sheet/modal.
- Settings / staff: centered white forms (max ~920px), gold hairline under titles, no peach card borders.

## Elevation & Depth

Flat pad with hairline gold rule; soft shadow only on tear-off day sheet. No multi-layer SaaS card stack.

## Shapes

Tighter radii (6–10px). Prefer sheet corners on the pad over 999px pills. Subnav tabs slightly squared.

## Components

### Chrome

Cool bar, monochrome icons, status line for shift state.

### Calendar pad

Board fill, month label, even date grid, today = printed orange ring, past days quieter, weekends via type weight/ink — not peach gradients.

### Settings & staff

White forms, ink labels, orange primary save, ghost secondary with ink/hairline.

### Modal / tear-off

Day detail enters as a sheet torn from the pad (short transform optional, 150–200ms, reduced-motion: instant).

## Do's and Don'ts

**Do**

- Keep `#FF7A00` and logo.
- Put warmth on the pad; keep chrome cool.
- Prefer tokens in `design-kit.css` / CSS vars; migrate hard-coded peach hex away on touched files.
- Preserve E2E-facing labels and roles.

**Don't**

- Recreate peach page (`#fff8f2`) + peach borders everywhere.
- Rainbow Material icon colors.
- Inter as cabinet face.
- Expand redesign to landing/client/Вменю in the pilot.

## Cross-surface reach

Pilot order: chrome → calendar → organization/settings → staff. Other spheres inherit tokens once chrome+calendar land.
