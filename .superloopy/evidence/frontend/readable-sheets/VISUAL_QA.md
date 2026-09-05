# Readable, sortable futures Sheet

Production preview: `/KJHSTOCK/`, hash routing, real Binance REST and WebSocket data.
Reviewed on 2026-09-06 with the Codex browser.

## Evidence

- `before-1280.png`: the existing public dashboard.
- `design-reference.png`: generated direction, explicitly labelled example data.
- `after-390.png`, `after-768.png`, `after-1280.png`: actual final browser captures.
- `viewport-checks.json`: no document overflow at all three widths; only the 1200px Sheet scrolls.
- `sort-browser-checks.json`: all ten headers, both directions, 20 passing comparisons on actual visible rows. Unit tests separately verify the complete dataset sorter and missing-value behavior.
- `flow-checks.json`: search, empty results, favorite filtering and persistence after reload, paging, keyboard navigation, chart and report views. The table keeps its header/name sticky and resets vertical scroll from 481px to 0 on explicit page changes.
- `design-compliance.json`: passed with no violations.
- `react-doctor.json`, `PERF.md`: performance review and its limits.

## Visual review and iteration

The first mobile pass put the table below all eight filter controls. The final native disclosure keeps search visible and makes the other controls available on demand. Mobile spacing uses the existing 12px/16px tokens. Names remain readable while horizontally scrolling; numbers are right aligned and use tabular figures. The active sorting header shows both an arrow and a tint. Korean labels are legible without clipped text.

The generated reference is directional, not a pixel-clone target. The diff reports an 81 similarity score and a 19.3% differing-pixel ratio, with unequal source dimensions; this is not an accessibility or quality score. Reviewed hotspot groups against both full images:

- Grid row 6 (all columns), and lower row 7: the reference's six mock rows are replaced by a 50-row live table with favorite, market, contract, signal and rank columns. Source: the Sheet table and pagination in `BinanceFutures.tsx`.
- Grid rows 4 and 5: separate search/disclosure and explanatory Sheet heading move the table down. These preserve existing filters and explain sorting. Source: `.market-filters`, `.market-filter-disclosure`, `.market-sheet` in `market-workspace.css`.
- Grid rows 0 and 1: smaller actual brand, explicit status for each market, and a real data timestamp. Source: `.market-header` and `.market-intro`.
- Grid rows 2 and 3: the existing highest-gainer/loser metrics are preserved instead of the mock's count metrics; a fourth analysis tab preserves the selected-contract view. Source: summary strip and Radix tabs.

No remaining clipping or document overflow was found. No image or screenshot substitutes for functional UI.

## Interaction and state checks

- All data headers are native buttons inside scoped table headers with `aria-sort`.
- Sorting applies to the full filtered dataset before pagination; missing funding stays last in both directions.
- Filtering and sorting return to page 1; removing rows clamps the current page.
- Favorite buttons do not open analysis; favorite state survives reload.
- Enter on a contract moves focus to the revealed analysis panel; returning focuses the Sheet tab and retains filters.
- Loading text was observed while real data loaded; empty results were exercised with a nonmatching search and reset. Network failure/retry handling remains in source. A live network failure was not induced in this browser session.
- No browser console errors during the final chart/report/Sheet flow.
- Existing chart animations stay disabled. Reduced-motion CSS disables the loading spinner.
- Light mode only; dark mode was outside this request.

## Design pre-flight

Passed for the edited workspace: deliberate Noto Sans KR stack; slate/white/teal palette; no gradients, glow, decorative status indicators or stock imagery; real chart data and Lucide icons; no invented metrics or placeholder copy; compact left-aligned heading; consistent tokenized corners, spacing and focus; summary strip, underline navigation, disclosure, table and analytical charts provide distinct layout forms. Uppercase contract symbols and live timestamps are functional data. Existing chart colors remain documented categorical encodings. No em-dash separators were introduced.

## Verification

TypeScript passes. Production Vite build passes with an existing large shared-chunk warning. The full Vitest suite passes: 90 tests in 17 files. New regression coverage includes immutable sorting, natural names, missing values, COIN-M units, nullable funding, and isolation of USD-M/COIN-M combined WebSocket messages.

Limits: Lighthouse was not run because this session's supported browser interface does not expose its browser debugging connection. No Lighthouse score or universal performance pass is claimed. See `PERF.md`.
