# Visitor chat verification, 2026-09-06

The existing market workspace is the visual target; TARGET.md describes its
bounded chat extension. Existing colors, typography, icons and filter layout are
retained. Name/composer precede the newest-first conversation list.

- Desktop 1280x900: left 288px chat column and independently usable Sheet;
  desktop-empty.jpg and desktop-messages.jpg.
- Mobile 390x880: initial collapsed disclosure, open message/name view;
  mobile-collapsed.jpg and mobile-open.jpg. DOM width and scrollWidth both 375.
- Tablet 768x900: usable inputs and wrapped error copy, retained draft and prior
  messages after stopping the local API; tablet-failed-draft.jpg. DOM width and
  scrollWidth both 753.
- Real browser sent a named message to local D1. A different HTTP client sent a
  second local message; the browser displayed it first after polling. The API
  returned stored names, bodies and server timestamps. No production test message.
- Before name entry, composer/send are disabled. After name save they become
  usable. Successful send clears the draft; failed send preserves it and enables
  retry. Mobile disclosure and desktop expansion were exercised.
- 180 tests passed across 21 frontend/server test files. Chat tests cover request
  serialization, stale reads, idempotent retries, cancellation, invalid payloads,
  Unicode normalization, missing configuration and stable newest-first ordering.
- Separate service: 4 SQLite integration tests passed, TypeScript and production
  build passed. Service deployment succeeded; public GET=200, preflight=204 and
  CORS allows the existing GitHub origin. Production message list was empty.

Anti-slop preflight: existing Noto Sans KR/teal/light system; zero new decorative
images, gradients, shadows, status dots or fake presence numbers; no new em-dashes
or uppercase eyebrows; no repeated card grid. Table/chart assets retain purpose.
Tokens, focus, error/empty/loading/disabled states and reduced motion checked.
COMPLIANCE.json reports no violations. Scroll-anchor code was reviewed; long-list
anchor behavior has not been separately exercised in the browser.

Production dashboard publication is verified separately after source merge.
