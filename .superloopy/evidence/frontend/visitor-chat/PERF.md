# Quality measurements

Design compliance passed for VisitorChat.tsx, visitor-chat.css and the shared
market stylesheet. Production Vite build passed. Binance route is 141.51 kB,
44.26 kB gzip (previous 126.76 / 39.46); route CSS 33.11 / 5.53 kB. Existing shared
entry remains 668.47 / 197.80 kB and retains its previous size warning.

Chat is isolated in its own component; five-second polling does not rerender the
market page, stops when hidden, has bounded 100-message payloads, cancels stale
reads and allows only one send. No runtime library dependency was added.

Lighthouse was not measured: the approved in-app browser exposes viewport and
DOM tooling but no Lighthouse/CDP connection. No score or performance-pass claim
is made. No separate browser was launched to bypass that interface.
