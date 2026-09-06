# Coin purpose descriptions

Verified 2026-09-06 on the production build in the existing in-app browser.
User flow: Sheet name → selected contract → purpose, token role, official source
and reviewed date, before quote metrics. No external metadata API or AI call is
required at runtime; descriptions stay available during candle loading or failure.

## Content and matching

- 69 original Korean summaries, each within 300 Unicode characters. All records
  carry a primary project source and a review date. The longest is 126 characters.
- Base asset identity determines the description across USD-M/COIN-M, quote
  currencies and dated contracts. No stripping arbitrary digits or guessing
  renamed assets. 1INCH remains a distinct ticker; LUNA/LUNC are not merged.
- Four explicit 1000-unit aliases were verified with the Binance plugin's index
  constituent endpoint on 2026-09-06. Its own Binance constituents are:

| Contract | Binance spot constituent |
|---|---|
| 1000SHIBUSDT | SHIBUSDT*1000 |
| 1000PEPEUSDT | PEPEUSDT*1000 |
| 1000BONKUSDT | BONKUSDT*1000 |
| 1000FLOKIUSDT | FLOKIUSDT*1000 |

Endpoint documentation: https://developers.binance.com/en/docs/catalog/core-trading-derivatives-trading-usd-s-m-futures/api/rest-api/market-data#query-index-price-constituents

CoinPaprika had a conflicting BULLA purpose description despite a matching token
identity; its description was not used. BULLA remains explicitly unregistered
because sufficient primary project text was unavailable. No claim of complete
market coverage or automatic content refresh is made.

## Browser evidence

- ETHUSDT displayed the 81-character Ethereum purpose, category, official
  ethereum.org source and 2026.09.06 review date.
- 1000SHIBUSDT displayed Shiba Inu and its explicit 1,000-unit contract note.
- Switching to BULLAUSDT removed the previous description and source, replacing
  them with an explicit statement that the purpose has not been confirmed.
- SNDKUSDT displayed the separate TradeFi notice, never a crypto description.
- 390 / 768 / 1280 layouts were visually reviewed. No document overflow or clipped
  description, and the source link and date wrap cleanly on mobile.
- No console errors from the final build. Existing source links have visible
  keyboard focus; static data needs no additional loading/error state.

The before/after diff is retained as evidence of the added block. Changed text,
live prices and shifted metrics are intended, not reference-matching defects.
The component extends the existing design; no new design direction or raster
mockup was needed. Existing chart imagery and icon system remain in place.
Anti-slop review: token consistency, normal text weight, no decorative card,
gradient, shadow, motion, promotional language or invented certainty.

## Verification

TypeScript passed. Production build passed. 135 tests across 20 files passed,
including 7 new catalog, identity, Unicode limit and unknown-asset checks.
Design compliance: zero violations. Independent code and sampled source review
found no blocking issue. See PERF.md for the unmeasured Lighthouse limitation.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/frontend/coin-purpose/VISUAL_QA.md
