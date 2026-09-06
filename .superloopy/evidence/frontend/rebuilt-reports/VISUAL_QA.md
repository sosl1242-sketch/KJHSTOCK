# Visible Sheet filters and rebuilt research report

Verified on 2026-09-06 using the production build, base /KJHSTOCK/ and hash routing,
in the existing Codex in-app browser. No mocked data was inserted into the browser.

## Visual review

Reviewed Sheet and report at viewport widths 390, 768 and 1280. Saved screenshots
exclude browser scrollbars; their image widths are 375, 753 and 1265 respectively.
The report has no page-level horizontal overflow. The wide Sheet scrolls inside its
own region. All five labelled filter controls remain visible without expansion.
Mobile evidence and scenario sections wrap into readable columns; observation rows
expand with clear direction labels. Final body descriptions use normal text weight.

The image-generated reference was created before the new report UI. The implemented
surface preserves its editorial hierarchy, integrated metrics, breadth bar, restrained
palette and explicit timestamp. Actual calculations use top-three concentration,
six evidence disclosures and actual coverage, replacing illustrative values. The
raw visual diff is retained, but different dimensions and live text mean its 80
similarity score is not a pixel-fidelity pass. Visual review is the acceptance basis.

## Browser flows

- COIN-M filter showed 30 rows, all COIN-M.
- Weak signal filter showed 47 rows, all weak.
- USDT + weak signal + HEMI search showed only HEMIUSDT; active count was 3.
- TradeFi filter showed 189 contracts including SNDKUSDT and CLUSDT.
- Reset cleared search and filter values, preserving the chosen sorting.
- All ten sortable column buttons remain present; 50 rows are rendered per page.
- Entering the report fetched six distinct base assets with 12/12 fresh 1h/4h frames.
- Refresh displayed bounded request progress and kept the previous report until ready.
- Switching views preserved the report generation time; manual refresh changed it.
- Candidate disclosures expanded; ETHUSDT detail action opened the correct contract.
- Method disclosure exposed calculation rules and official Binance documentation.
- Export created Downloads/kjhstock-market-research-2026-09-06.md (12,539 bytes),
  and its contents matched the displayed snapshot. The browser download-event wrapper
  timed out, so the actual saved file was verified instead.
- No browser console errors were reported for the final build.

## Data and regression evidence

TypeScript and production build passed. Vitest: 19 files, 128 tests passed.
Freshness uses exchange time, never REST receipt time. Missing or invalid timestamps
remain unknown. Closed-candle indicators use only the consecutive suffix after the
last gap; disconnected history cannot contaminate EMA/RSI. Tests cover malformed,
missing, stale and conflicting data; 4-request concurrency; partial failure; abort;
fresh refreshes; nonpositive price boundaries; existing Sheet sorting and favorites.

Independent quality review found the exchange-time and candle-gap bugs before final
verification; both were fixed with tests that failed before the fixes. Design token
compliance has zero violations. Live outage injection and clipboard mutation were
not performed; deterministic transport tests cover failure and cancellation.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/rebuilt-reports/VISUAL_QA.md
