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
