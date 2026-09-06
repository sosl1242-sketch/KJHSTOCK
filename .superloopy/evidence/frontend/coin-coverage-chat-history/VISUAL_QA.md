# Coin coverage and accumulated chat

Verified 2026-09-06 in the Codex Chromium browser at 390×844, 768×1000,
and 1280×1000. Existing DESIGN.md tokens and restrained market layout retained.

- USD-M and COIN-M active crypto universe: 524/524 covered, no missing identities;
  526 catalog profiles, no duplicates, longest description 135 Unicode characters.
- New SIREN entry opened from Sheet, correct summary and BitMart source shown.
  The source label distinguishes project documentation from exchange explanations.
- Local in-memory SQLite chat began with 220 messages on four dates. Initial
  latest page displayed 100 at bottom; older-page buttons produced 200 then 220.
- With an older message in view, 235 additional messages arrived in three pages.
  All 455 were present, anchor qa-seed-0020 stayed at -15.421875 px relative to
  its scroll region. New-message button appeared and returned to exact bottom.
- Local name/save/send interaction added message 456. Only that confirmed message
  was styled as mine despite existing messages sharing the display name.
- Mobile source text wraps, chat composer remains operable below the transcript,
  and document scrollWidth does not exceed viewport at any checked size.
- Semantic headings, explicit labels, visible source links, disabled send without
  a name, chronological date separators, reduced-motion CSS retained.
- No generated decorative assets, added gradients, or new color vocabulary.

Screenshots: desktop-chat.jpg, desktop-introduction.jpg,
tablet-introduction.jpg, mobile-introduction.jpg, mobile-chat.jpg.
No production chat messages were sent for testing.

Validation: 223 frontend/shared tests in 22 files; 9 backend SQLite tests;
both TypeScript checks and both production builds passed. The source workflow's
pre-existing Pages branch restriction is preserved; publication uses gh-pages.

Public deployment verification is recorded separately in evidence-record.json.

