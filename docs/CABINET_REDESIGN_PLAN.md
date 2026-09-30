# Cabinet redesign — implementation plan (next session)

Locked world: **Merchant Calendar Pad** · buildPath: **code**  
Baseline: [`DESIGN.incumbent.md`](DESIGN.incumbent.md) · Target: [`DESIGN.md`](DESIGN.md)

## Pilot order

1. **Chrome** — [`CabinetChrome.jsx`](frontend/src/CabinetChrome.jsx) + subnav CSS: cool chrome bar, Manrope, monochrome menu icons, tab-style bookmarks (drop peach pills / rainbow fills).
2. **Calendar** — [`BookingCalendar.jsx`](frontend/src/BookingCalendar.jsx) + calendar rules in [`styles.css`](frontend/src/styles.css): pad board surface, today ring, quiet past days, no weekend peach gradients; day modal as tear-off sheet motion (respect `prefers-reduced-motion`).
3. **Settings** — [`OrganizationSettingsPanel.jsx`](frontend/src/OrganizationSettingsPanel.jsx), [`GeneralSettingsPanel.jsx`](frontend/src/GeneralSettingsPanel.jsx): white forms, gold hairlines, tokenized borders.
4. **Staff** — [`StaffManagementPanel.jsx`](frontend/src/StaffManagementPanel.jsx): roster sheet styling aligned to forms.

## Token work

- Extend [`design-kit.css`](frontend/src/design-kit.css) with pad/chrome tokens from target `DESIGN.md`.
- On touched rules only: replace hard-coded `#fff8f2` / `#ffd9bd` / peach cell fills with tokens.
- Load Manrope for logged-in cabinet (already in `index.html` for landing) — set `--vm-font` / `:root` font-family for `.page-logged`.

## Guardrails

- Do not change logo asset or `#FF7A00` brand pin.
- Do not peach the full page; warmth stays on the pad.
- Keep E2E roles/names; run Playwright cabinet specs before push.
- Dark theme: remap pad/chrome pairs deliberately (not invert peach).

## Pilot status

Implemented (code-led Merchant Calendar Pad):

- Tokens in `frontend/src/design-kit.css` (`--vm-chrome`, `--vm-pad`, Manrope, gold hairline).
- Overrides in `frontend/src/cabinet-pad.css` (imported last from `App.jsx`).
- Chrome: monochrome menu icons; cool subnav tabs with orange underline active.
- Calendar: `calendar-pad` board, past cells, no peach weekend gradients; day sheet tear-off motion.
- Settings / staff: white sheets + gold title rules via `.cabinet-sheet` / `.staff-roster-sheet`.

Next: visual QA in browser + Playwright cabinet specs before push.
