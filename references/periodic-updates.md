# Periodic Updates Reference

This project uses local machine cron for scheduled stock/cache refreshes. Vercel Cron is intentionally not used.

## Runtime Model

- Vercel serves the web app and tRPC read/write API.
- The operating PC runs cron entries from `/home/pyongjoo/Code/00_Refrech_Cron`.
- Cron executes `pnpm cron:*` scripts inside `/home/pyongjoo/Code/kjhstock`.
- The scripts connect to Supabase Postgres with `DATABASE_URL` and update cache tables directly.
- No `/api/scheduled/*` routes are deployed.

## Configured Jobs

| Local task | Suggested schedule | Purpose |
| --- | --- | --- |
| `pnpm cron:prices -- --batch-size 40` | Every minute during Korean market hours | Refresh stale Korean stock prices in batches. |
| `pnpm cron:caches` | Every 12 hours | Sync public financial and technical indicator caches. |
| `pnpm cron:seed` | Manual or on install | Ensure the baseline stock list exists. |

The local crontab should set `TZ=Asia/Seoul` so Korean market-hour schedules are easy to read.

## Manual Testing

```bash
cd /home/pyongjoo/Code/kjhstock
set -a
. /home/pyongjoo/Code/00_Refrech_Cron/.env
set +a
pnpm cron:seed
pnpm cron:prices -- --batch-size 5
pnpm cron:caches
```
