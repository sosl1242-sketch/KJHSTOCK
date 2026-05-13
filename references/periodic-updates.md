# Periodic Updates Reference

This project uses Vercel Cron for scheduled stock/cache refreshes.

## Runtime Model

- Vercel invokes cron paths with HTTP `GET` requests against the production deployment.
- Cron definitions live in `vercel.json`.
- `CRON_SECRET` must be set in Vercel. Vercel sends it as `Authorization: Bearer <CRON_SECRET>` and the handlers reject requests that do not match.
- Scheduled handlers are mounted in `server/_core/app.ts` and implemented in `server/scheduled.ts`.

## Configured Jobs

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/scheduled/refreshStockPrices` | `0 0 * * *` | Refresh stale Korean stock prices in batches. |
| `/api/scheduled/syncPublicQueryCaches` | `0 12 * * *` | Sync public financial and technical indicator caches. |

Vercel cron expressions are 5-field UTC expressions. Hobby projects are limited to daily schedules; Pro and Enterprise plans support higher-frequency cron jobs.

## Local Testing

Run the app locally with `CRON_SECRET` set, then call:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/scheduled/refreshStockPrices?batchSize=5"
```

For manual production testing, use the same header against the deployed URL.
