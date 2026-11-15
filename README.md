# my-veicolo

PWA to manage cars: deadlines, renewals, maintenance, documents, push reminders. UI in Italian, dark only. See [PLAN.md](PLAN.md).

## Stack

pnpm workspaces + Turborepo · Vite + React + TanStack Router/Query/Form · vite-plugin-pwa · Hono on Vercel Functions · Better Auth · Drizzle + Neon Postgres · Tailwind.

```
apps/web         SPA + service worker; Vercel project root
  api/index.ts   Vercel Function entry → Hono app from @my-veicolo/api
apps/api         Hono API (bundled with tsdown to dist/app.mjs)
  src/app.ts     createApp(getDeps): routes, Better Auth at /api/auth/*
  src/access.ts  canAccessVehicle: the one authorization rule for vehicle data
  test/          Vitest on in-memory PGlite (incl. cross-user access tests)
packages/db      Drizzle schema, migrations, Neon client, PGlite (dev/tests)
packages/shared  Zod schemas and shared logic
packages/config  Shared tsconfig
```

## Setup

Requires Node ≥ 22 and pnpm 11 (`npm i -g pnpm@11`; the exact version is pinned in `packageManager`).

Dependency versions live in one place: the `catalog` in `pnpm-workspace.yaml`. Packages reference them with `"catalog:"` and internal packages with `"workspace:*"`. To upgrade, change the catalog and run `pnpm install`. pnpm 11 refuses packages published less than a day ago (`minimumReleaseAge`, strict), as a supply-chain safeguard.

```sh
pnpm install
cp .env.example .env        # or: vercel env pull .env
pnpm -s vapid               # paste the keys into .env
pnpm dev                    # web on :5173, api on :8787 (proxied at /api)
```

`pnpm dev` uses a **local PGlite database** in `apps/api/.data` (migrations applied on start), so it never touches production. Delete the folder to reset it. `DEV_DATABASE=neon pnpm dev` uses `DATABASE_URL` instead.

To become admin locally: put your email in `ADMIN_EMAILS` and sign up.

Other tasks: `pnpm build`, `pnpm test`, `pnpm typecheck`.

## Database

- Change the schema in `packages/db/src/schema`, then `pnpm --filter @my-veicolo/db db:generate` to create a migration.
- Apply migrations to Neon: `pnpm --filter @my-veicolo/db db:migrate` (uses `DATABASE_URL_UNPOOLED` from `.env`).
- Migrations are **not** applied automatically on deploy: run `db:migrate` before pushing code that needs them.

## Deploy (Vercel)

1. Import the repo in Vercel, set **Root Directory** to `apps/web` (framework: Vite; keep "Include files outside the root directory" on).
2. Connect the Neon database (Storage) → sets `DATABASE_URL`.
3. Add env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `BETTER_AUTH_SECRET`, `ADMIN_EMAILS`, and `ENABLE_EXPERIMENTAL_COREPACK=1` (makes Vercel use the pnpm version from `packageManager`).
4. Deploy. `/api/*` is rewritten to the Hono function (region `fra1`, next to the database), everything else to the SPA (see `apps/web/vercel.json`).

## Testing push

Log in, open **Notifiche**:

- **Android**: Chrome → install the app (or use it from the browser) → "Attiva notifiche" → "Invia notifica di prova".
- **iPhone (iOS 16.4+)**: Safari → Share → *Add to Home Screen* → open from the icon → log in → "Attiva notifiche". Use "Invia tra 10 secondi" and close the app to check background delivery.

Test notifications go to all devices of the logged-in user. Logging out removes the device.
