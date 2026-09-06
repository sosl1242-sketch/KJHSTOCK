# Sheet drag and horizontal navigation

The existing market Sheet is the visual target. Preserve readable column widths,
sticky names and headings; add one upper horizontal range plus mouse panning.
The existing native scrollbar, wheel and touch gestures remain available.

Real-browser results on 2026-09-06:
- At 1280px, dragged a price row from x1040 to x600. Horizontal position changed
  from 0 to 323 (the exact maximum), the last rank column ended at the scroll
  region's right edge, range value became 323 and Sheet remained selected.
- A normal rank-header click sorted ascending. The ETH name button opened its
  analysis, and returning to Sheet remounted a working range with max323.
- 768px: range End reached507; final column and content edge both718px.
- 390px: range End reached869; final column and content edge both348px. Home
  returned the scroll area and range to0. Page width matched viewport client width
  at both sizes (753px / 375px), with no whole-page horizontal overflow.
- Screenshots: before-1280.jpg; after-1280.jpg; after-768.jpg; after-390.jpg.
- Existing production chat intentionally rejects localhost origin; the unrelated
  chat connection error in preview screenshots is expected. Its configuration
  and backend are unchanged, and production connectivity is checked separately.

Design compliance: COMPLIANCE.json reports zero violations. Existing Noto Sans KR,
teal, neutral borders, Lucide icons and spacing tokens are retained. No new colors,
shadows, images, animations, em-dashes, uppercase eyebrows or decorative cards.
The new range has an accessible label, end-position text, disabled states and
keyboard support. Native touch/zoom was preserved in code; touch hardware was not
emulated. Mouse drag cancellation and click gating are covered by controller tests.

Production route build: 146.13kB JS / 45.79kB gzip; CSS34.30 / 5.72kB. No runtime
package added. Lighthouse remains unmeasured because the approved in-app browser
has no Lighthouse connection; no score claim is made.

Final validation: 213 tests passed across 22 files, TypeScript and build passed.
