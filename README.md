# my-veicolo

PWA to manage cars: deadlines, renewals, maintenance, documents, push reminders. UI in Italian. See [PLAN.md](PLAN.md).

## Stack

pnpm workspaces + Turborepo · Vite + React + TanStack Router/Query · vite-plugin-pwa · Hono on Vercel Functions · Tailwind.

```
apps/web        SPA + service worker; Vercel project root
  api/index.ts  Vercel Function entry → Hono app from @my-veicolo/api
apps/api        Hono API (bundled with tsdown to dist/app.mjs)
packages/shared Zod schemas and shared logic
packages/config Shared tsconfig
```

## Setup

Requires Node ≥ 22 and pnpm 11 (`npm i -g pnpm@11`; the exact version is pinned in `packageManager`).

Dependency versions live in one place: the `catalog` in `pnpm-workspace.yaml`. Packages reference them with `"catalog:"` and internal packages with `"workspace:*"`. To upgrade, change the catalog and run `pnpm install`. pnpm 11 refuses packages published less than a day ago (`minimumReleaseAge`), as a supply-chain safeguard.

```sh
pnpm install
pnpm -s vapid > .env                                # VAPID key pair for Web Push
echo "VAPID_SUBJECT=mailto:you@example.com" >> .env
pnpm dev                                            # web on :5173, api on :8787 (proxied at /api)
```

Other tasks: `pnpm build`, `pnpm test`, `pnpm typecheck`.

## Deploy (Vercel)

1. Import the repo in Vercel, set **Root Directory** to `apps/web` (framework: Vite; keep "Include files outside the root directory" on).
2. Add env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and `ENABLE_EXPERIMENTAL_COREPACK=1` (makes Vercel use the pnpm version from `packageManager`).
3. Deploy. `/api/*` is rewritten to the Hono function, everything else to the SPA (see `apps/web/vercel.json`).

## Testing push

Open `/push-test`:

- **Android**: Chrome → install the app (or use it from the browser) → "Attiva notifiche" → "Invia notifica di prova".
- **iPhone (iOS 16.4+)**: Safari → Share → *Add to Home Screen* → open from the icon → "Attiva notifiche". Use "Invia tra 10 secondi" and close the app to check background delivery.

`POST /api/push/test` is a Phase 0 spike endpoint without auth; it is replaced by authenticated endpoints in Phase 1.
