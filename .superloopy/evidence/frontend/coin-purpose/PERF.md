# Performance evidence

Production build: 6.95 seconds on this machine. Binance route JavaScript:
126.76 kB minified / 39.46 kB gzip; route CSS 26.85 kB / 4.66 kB gzip.
The added static catalog is about 9.5 kB gzip over the previous route build.
Descriptions require no additional request, secret, runtime translation or loading
effect. Identity lookup uses a Map and does not depend on the live quote values.

The inherited shared entry remains 668.47 kB minified / 197.79 kB gzip and still
triggers Vite's 500 kB advisory. No threshold was raised. Lighthouse was not
measured: the approved browser surface does not expose its required debugging
connection. No browser performance score or unmeasured timing is claimed.
