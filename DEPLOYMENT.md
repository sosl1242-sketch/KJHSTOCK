# Current public site deployment

The public URL is https://sosl1242-sketch.github.io/KJHSTOCK/.

Verified GitHub Pages settings on 2026-09-06 use branch publishing (legacy build),
with source `gh-pages` at `/`. The `github-pages` environment permits that branch.
The dashboard source branch is `feature/binance-futures-live-dashboard`.

Merging source alone does not publish the website. The existing source workflow
builds a `github-pages` artifact, but its direct deploy job is rejected by the
environment's branch policy. Keep that policy in place. Publish the verified
artifact contents to the configured `gh-pages` branch using a normal fast-forward
push, and confirm the resulting `pages build and deployment` run succeeds.

Build configuration: Node 24, pnpm 10.4.1, `VITE_BASE_PATH=/KJHSTOCK/`,
`VITE_ROUTER_MODE=hash`, output `dist/public`. Retain `.nojekyll` when publishing.
Record the source commit in the publication commit and reload the public site to
verify the delivered features. A local preview or successful source build is not
evidence that the public deployment changed.

## Visitor chat

The Pages build sets `VITE_CHAT_API_URL` to the KJHSTOCK visitor-chat service at
https://kjhstock-visitor-chat.arcane-chord-3426.chatgpt.site.
The service is hosted with Sites and stores messages in D1; GitHub Pages remains
the dashboard host. The service root redirects to the existing dashboard.
Sites project: `appgprj_6a9cf9a1c6e881918d09dd3b565f01dd`. Its separately versioned
source checkout is `../KJHSTOCK-chat-service`; source is also saved in Sites.

`GET /api/messages` returns the latest 100 messages, newest first.
`POST /api/messages` requires a display name (1–20 Unicode characters), a body
(1–500), a browser client UUID and an idempotent request UUID. Names are unverified
display names. Only public message fields are returned. SQL uses bound values,
length constraints and unique request IDs. The server limits repeat sends to one
per 3 seconds per client and 30 requests per minute per network address.
The address itself is not stored; a daily hash in a temporary rate table is used.
Do not put private information in this public conversation.

The production CORS allowlist includes the exact GitHub Pages origin. No secret
is embedded in the frontend. For local write tests, run the service's local D1
instance on port 3000 and build the frontend with
`VITE_CHAT_API_URL=http://127.0.0.1:3000`. Never seed production conversations.
The frontend polls every 5 seconds while the browser tab is visible. Failed sends
retain the draft and reuse the request UUID on retry. Missing configuration and
connection failures have explicit UI states and never fall back to local chat.
