# Supabase Setup

## Required Supabase Values

Create a Supabase project, then copy these values into Vercel project environment variables:

| Vercel env | Supabase location | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Project Settings > Database > Connection string | Use the pooled Postgres connection string for Vercel/serverless. URL-encode special characters in the DB password. |
| `SUPABASE_URL` | Project Settings > API > Project URL | Server runtime. |
| `SUPABASE_ANON_KEY` | Project Settings > API > anon public key | Server runtime token verification. |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` | Client build-time env. |
| `VITE_SUPABASE_ANON_KEY` | Same as `SUPABASE_ANON_KEY` | Client build-time env. |
| `SUPABASE_ADMIN_EMAIL` | Your admin login email | First matching email is promoted to local `admin` role on login. |
| `CRON_SECRET` | Random string, at least 16 chars | Vercel Cron request guard. |

`SUPABASE_SERVICE_ROLE_KEY` is optional. Do not expose it as a `VITE_` variable.

## Auth Settings

In Supabase Auth:

1. Enable Email provider.
2. Keep email confirmations enabled if you want verified signups.
3. Set Site URL to `https://kjhstock.vercel.app`.
4. Add redirect URLs for `https://kjhstock.vercel.app/**` and local dev if needed, such as `http://localhost:3000/**`.

## Database Migration

Run the committed Drizzle Postgres migration against Supabase:

```bash
DATABASE_URL="postgresql://..." pnpm db:migrate
```

The old MySQL migrations were replaced with a clean Postgres baseline in `drizzle/0000_material_vermin.sql`.

The baseline also enables Row Level Security on app tables and revokes direct `anon`/`authenticated` table grants. The browser only uses Supabase Auth; data access flows through the Vercel API and its server-side database connection.

## Capacity Estimate

The app is small for Supabase:

- Stock master rows: a few hundred rows.
- Financial cache: a few hundred rows.
- Price history cache: roughly `symbols * candles`. For 300 symbols and 1 year of daily candles, expect about 75,000 rows.
- Crypto and US stock caches are also small.

Practical starting size is usually under 100 MB. Even with several years of daily candles for Korean, US, and crypto symbols, this should stay well under 1 GB unless you start storing intraday candles or large raw API payloads.
