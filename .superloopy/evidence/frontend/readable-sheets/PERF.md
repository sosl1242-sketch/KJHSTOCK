# Performance evidence

Production configuration matches GitHub Pages: `VITE_BASE_PATH=/KJHSTOCK/`, `VITE_ROUTER_MODE=hash`.

The final Vite build completed in 8.59 seconds on this machine. Sizes are build outputs, not network timings:

| Output | Minified | Gzip |
|---|---:|---:|
| HTML | 0.90 kB | 0.55 kB |
| Binance page JavaScript | 95.09 kB | 27.90 kB |
| Binance page CSS | 15.79 kB | 3.23 kB |
| Shared chart module | 425.19 kB | 115.47 kB |
| Shared entry JavaScript | 668.49 kB | 197.80 kB |

Development locator/runtime/debug plugins now run only outside production. The intermediate production HTML before that correction measured 367.73 kB; it now measures 0.90 kB. Optional analytics is loaded only when its environment variables are configured. App routes are lazy loaded; the table renders at most 50 rows instead of hundreds. Sorting remains over the complete filtered dataset.

The shared entry still exceeds Vite's 500 kB advisory threshold. The warning remains visible. Further shared dependency splitting and on-demand loading of the chart module are possible follow-up work; no warning threshold was raised.

React Doctor completed with `ok: true` and no errors. Its warnings include existing large analytical components, inherited filter/map chains, chart loading within the lazy route, and deliberate stable identifier dependencies for periodic live data. Its captured anchor warning was fixed with a native button afterward.

Lighthouse: not measured. The approved browser interface in this session does not expose the browser debugging connection required by Lighthouse. No substituted headless score or unmeasured speed claim is provided.
