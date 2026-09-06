# Performance evidence

Final production build completed in 7.37 seconds on this machine. These are build
sizes, not browser timing measurements:

| Output | Minified | Gzip |
|---|---:|---:|
| HTML | 0.90 kB | 0.55 kB |
| Binance route JavaScript | 96.64 kB | 29.97 kB |
| Binance route CSS | 25.30 kB | 4.50 kB |
| Shared chart module | 425.19 kB | 115.47 kB |
| Shared entry JavaScript | 668.47 kB | 197.79 kB |

Research requests start when the report is first opened or manually refreshed.
The engine inspects up to six representative contracts in two timeframes, with at
most four requests in flight. Requests have 15-second deadlines, and leaving the
view cancels the active generation. Completed reports remain stable across live
Sheet updates; there is no background report interval. The Sheet still renders
50 rows while filtering and sorting the full dataset.

The inherited shared entry still exceeds Vite's 500 kB advisory threshold. The
threshold was not raised. Lighthouse was not measured because the approved browser
interface does not expose its required debugging connection; no speed score is claimed.
