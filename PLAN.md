# my-veicolo — Plan

A small PWA to manage cars for me and a few people (family/friends). Anyone can **sign up** with email + password; the **admin** sees the user list, adds cars by plate (the only one who triggers paid lookups) and assigns them to users. Users see their assigned cars, get **push reminders** for deadlines, and tell the app when they've renewed something. Installable on Android and iPhone, no app stores, hosted on a free `*.vercel.app` URL.

---

## 1. Goals & non-goals

**Goals**
- Admin adds a vehicle from its plate; technical data is auto-filled **once per vehicle** from a paid API.
- Users self-register; admin assigns vehicles to them; users see only their vehicles.
- One place for all car info: specs, documents, deadlines, maintenance, costs.
- **Push reminders** (revisione, bollo, RCA, tagliando, tyres) — part of the MVP.
- One-tap **"I renewed it"** flow that rolls the deadline forward and stops reminders.
- Cheap: €0/month hosting, **~€1 max per car, never per update**.

**Non-goals**
- App Store / Play Store, custom domain.
- Multiple languages: the **UI is Italian only** (no i18n library; strings written directly in Italian, `lang="it"`, dates/currency formatted with `it-IT`). Code, comments and docs stay in English.
- Users triggering paid API calls, or requesting new cars (admin adds them directly).
- Notifying the admin when a user renews something.
- Sending emails (no domain → no reliable sender): no email verification, no emailed password reset.
- Bulk lookups / reselling data, PRA visura automation (link out instead).

---

## 2. Users, roles & permissions

**Sign-up / login**
- Public **sign-up with email + password**, then login with the same. Sessions via secure cookie, long-lived (e.g. 60 days, sliding) so phone users rarely log in again.
- A freshly registered user has **no vehicles** → sees a "Waiting for the admin to assign you a car" screen (plus the install/notifications onboarding, so they're ready when a car arrives).
- No email verification (no sender) → an email address is just a username. That's safe because **signing up grants nothing**: data access only comes from an admin assignment, and the admin knows who they're assigning to.
- Abuse guard: Better Auth built-in rate limiting on auth endpoints; env flag `SIGNUP_ENABLED` to close registration at any time; admin can ban users.
- Forgot password → user asks the admin → admin generates a **one-time reset link** (valid 24h) and sends it via WhatsApp/Telegram.
- **First admin**: env var `ADMIN_EMAILS`; a user who signs up with one of those emails gets `role = admin`. (Sign up as admin right after the first deploy.)

| Action | Admin | User |
|---|---|---|
| See user list, ban/unban, generate reset link | ✅ | — |
| Promote/demote admin | ✅ | — |
| Add vehicle by plate (paid lookup) | ✅ | — |
| Re-run a paid lookup | ✅ (explicit confirm) | — |
| Assign / unassign vehicles to users | ✅ | — |
| Delete vehicle | ✅ | — |
| See vehicle, specs, deadlines | ✅ all | ✅ assigned only |
| Mark deadline renewed, edit deadlines | ✅ | ✅ assigned only |
| Maintenance log, fuel, expenses, documents | ✅ | ✅ assigned only |
| Free checks / link-outs (revisione, RCA) | ✅ | ✅ |
| Manage own profile, password, push devices | ✅ | ✅ |

- A vehicle can be assigned to **multiple users** (shared family car); all assignees get its reminders.
- The admin is a normal user too (can be assigned their own cars).
- Enforced **server-side in the API** (every route scopes queries by assignment), not just in the UI. The browser never talks to the DB directly.

---

## 3. Features

### MVP (v1)
- **Auth**: sign-up / login with email + password, logout, change password, admin/user roles.
- **Admin panel**
  - **Users**: list (name, email, signed up, last seen, # vehicles, push enabled?), filter "unassigned", ban, reset link, promote.
  - **Vehicles**: add by plate → lookup → review pre-filled form → save → assign to user(s). Assignment also possible from the user's row ("assign plate…" picker).
  - **Lookup log**: every paid call, cost, who/when; monthly total vs budget.
- **User side**
  - "My vehicles" list & detail (photo, plate, make/model, key specs).
  - Deadlines with status (ok / soon / overdue).
  - Maintenance log, documents (libretto, policy, invoices).
  - Quick links to official checks (revisione, RCA, bollo).
- **Push notifications** for deadlines (see §5).
- **Renewal flow** — "I renewed it" (see §5).

### v2
- On-demand free checks: last revisione + RCA coverage fetched server-side (if scraping is reliable; otherwise keep link-outs).
- Fuel log (l/100km, €/km), expenses dashboard.
- `.ics` calendar feed per user (fallback for people who don't enable push).
- Passkey login (Better Auth plugin).

### Nice to have
- OCR of the insurance policy to pre-fill the renewal form (libretto OCR moved to Phase 3b).
- Km-based reminders (tagliando every X km) from last logged km.
- Export/backup to JSON/ZIP.

---

## 4. Paid API cost control

Goal: pay **once per car**, never per view/update/user.

1. **Only the admin** can call `POST /api/admin/lookup`. Users have no code path to a paid provider.
2. **Cache by plate forever** (`plate_lookup`). Technical data (make, model, kW, registration date…) doesn't change, so there's no reason to refresh. A second lookup for the same plate returns the cached row at €0.
3. **Force refresh** requires an explicit `force: true` + confirm dialog in the UI ("this costs ~€X").
4. **Budget guard**: env var `LOOKUP_MONTHLY_BUDGET_EUR`; the endpoint refuses once the month's logged spend would exceed it.
5. **Audit log** (`api_call_log`): provider, plate, cost, admin, timestamp, success/fail.
6. Everything that changes over time (deadlines, insurance, km) comes from **users** or **free sources**, never from the paid API.

---

## 5. Reminders & renewals

### Push notifications
- Daily **Vercel Cron** (Hobby plan: max 1 run/day — enough) at ~08:00 Europe/Rome.
- For each open deadline, send at thresholds **30 / 7 / 1 days before**, on the **due date**, then **every 3 days while overdue** (until marked renewed).
- Recipients: every user assigned to the vehicle, on every subscribed device.
- `notification_log(deadline_id, threshold, user_id)` prevents duplicates if cron reruns.
- Dead subscriptions (HTTP 404/410 from push service) are deleted automatically.
- Notification tap → deep link to `/renew/:deadlineId`.
- Android: notification **action buttons** "✅ Renewed" / "⏰ Remind me in 3 days". iOS web push doesn't support actions → tap opens the renew page.
- Settings page: enable push per device, "send test notification" button.
- Also: when the admin assigns a car to a user, that user gets a push ("A new car has been assigned to you: AB123CD").

### "Today I renewed my insurance"
A renewal is a first-class event, not just editing a date.

Entry points:
- Tap on a reminder notification.
- "Renewed" button on each deadline card (vehicle page).
- A global **"+ I did something"** button → pick vehicle → pick type (RCA, bollo, revisione, tagliando, gomme, other).

Renew form (pre-filled, one screen, most fields optional):
- **Date done**: defaults to today.
- **New due date**: auto-computed from type rules, editable:
  - RCA → +1 year from previous expiry (or policy end date entered by user)
  - Bollo → +1 year
  - Revisione → +2 years, end of month
  - Tagliando → +1 year and/or +X km
  - Gomme → next seasonal change (15 Apr / 15 Nov), editable
- **Cost** (optional) → also creates an expense entry.
- **Company / garage / km** (optional).
- **Attach document** (photo of new policy, receipt) — optional.

On save:
- `deadline_event` row is written (history: who renewed, when, cost, doc).
- Deadline moves to the new due date; its notification thresholds reset.
- Pending reminders stop for **all** assignees (shared car: one person renews, everyone stops getting nagged).
- Optional "snooze" instead of renew: postpones reminders without changing the due date.

v2: for RCA/revisione, optionally verify via the free public check and show "✔ confirmed by portal" next to the renewal.

---

## 6. Data sources (Italy)

| Data | Source | Method | Cost |
|---|---|---|---|
| Make, model, version, engine, kW, fuel, Euro class, registration date | Paid aggregator API (candidates: Openapi.it automotive, CarRegistrationAPI/RegCheck, Infocar) | Admin-only, **once per plate**, cached forever | ~€0.05–1 per car |
| Last revisione (date, km, outcome) | Portale dell'Automobilista (MIT) | Link-out (scrape in v2 if feasible) | Free |
| RCA coverage | ANIA / IVASS check page | Link-out (scrape in v2 if feasible) | Free |
| Bollo amount / status | ACI / regional portals | Link-out | Free |
| Owner / liens | PRA visura (ACI) | Link-out only | Paid, manual |

**Phase 0 spike:** compare 2–3 plate APIs on my own plate (fields, price, signup friction, prepaid vs subscription — prefer pay-per-call with no monthly fee).

---

## 7. Architecture

```
 Phone (PWA)                       Vercel project (root: apps/web)          Storage
┌──────────────────────┐        ┌───────────────────────────────┐      ┌──────────────────────┐
│ React SPA (Vite)     │        │ Static SPA (dist/)            │      │ Neon Postgres (free) │
│  TanStack Router/    │ HTTPS  │                               │      │  - app data          │
│  Query/Form          │ cookie │ api/[[...route]].ts           │─────▶│  - Better Auth tables│
│  Hono RPC client     │───────▶│   → imports Hono app from     │      └──────────────────────┘
│ Service worker       │        │     @my-veicolo/api           │─────▶ Private object storage
│  - precache shell    │◀───────│   - Better Auth, CRUD, admin, │       (documents/photos)
│  - push + actions    │  push  │     cron, push                │
└──────────────────────┘        └───────────────┬───────────────┘
                                                ▼
                                      Paid plate API (admin only)
```

- **One Vercel project**, root `apps/web`. Vite builds the SPA; `apps/web/api/[[...route]].ts` is a one-line Vercel Function entry that re-exports the Hono app from the `apps/api` workspace package. Same origin → session cookie, no CORS.
- **Hono API** with two middlewares:
  - `authed` → loads Better Auth session, rejects if missing/banned.
  - `admin` → extends `authed`, rejects if `role !== 'admin'`.
  - Vehicle-scoped routes call `assertVehicleAccess(user, vehicleId)` (admin bypass).
- **End-to-end types** via Hono RPC: the web app imports `type AppType` from `@my-veicolo/api` and uses `hc<AppType>('/api')`. Request bodies validated with `@hono/zod-validator` using schemas from `@my-veicolo/shared`.
- Files: browser uploads/downloads via **short-lived presigned URLs** issued by the API after the access check.

### Repo layout (pnpm workspaces + Turborepo)

```
my-veicolo/
├─ apps/
│  ├─ web/                    Vite + React SPA + PWA  (Vercel project root)
│  │  ├─ api/[[...route]].ts  Vercel Function entry → export from @my-veicolo/api
│  │  ├─ src/
│  │  │  ├─ routes/           TanStack Router (file-based)
│  │  │  ├─ sw.ts             custom service worker (precache, push, notificationclick)
│  │  │  └─ lib/api.ts        hc<AppType> client
│  │  ├─ vercel.json          crons, SPA rewrites
│  │  └─ vite.config.ts       vite-plugin-pwa (injectManifest), /api proxy in dev
│  └─ api/                    Hono app (no deploy of its own)
│     ├─ src/
│     │  ├─ app.ts            routes + middlewares, exports AppType
│     │  ├─ auth.ts           Better Auth config
│     │  ├─ routes/           admin, vehicles, deadlines, push, cron…
│     │  ├─ providers/        PlateProvider implementations
│     │  └─ dev.ts            local server (@hono/node-server)
│     └─ test/                Vitest, incl. cross-user access tests
├─ packages/
│  ├─ db/                     Drizzle schema, migrations, client (Neon)
│  ├─ shared/                 Zod schemas, types, deadline rules (pure, unit-tested)
│  └─ config/                 shared tsconfig / eslint
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

- `turbo dev` → runs `apps/web` (Vite, proxies `/api` → localhost) and `apps/api` (Node dev server) together.
- `turbo build / lint / test / typecheck` with caching; Vercel remote cache (free) + "skip unaffected builds".
- Deadline rules live in `packages/shared` so the renew form previews the next due date client-side with the exact same logic the API uses.

---

## 8. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Monorepo | **pnpm workspaces + Turborepo** | Vercel remote cache, affected-only builds |
| Frontend | Vite + React + TypeScript | SPA |
| Routing / data / forms | TanStack Router + Query + Form | Query cache persisted to IndexedDB for offline reads |
| PWA | **`vite-plugin-pwa`** (injectManifest, Workbox) | custom `sw.ts` for push + notification actions, update prompt |
| UI | Tailwind + shadcn/ui | mobile-first |
| API | **Hono** on Vercel Functions (Node) | Hono RPC for typed client, `@hono/zod-validator` |
| Validation | Zod | schemas shared in `packages/shared` |
| DB | **Neon** Postgres (free plan, via Vercel Marketplace) | scales to zero, never paused/deleted for inactivity; cold start < 1 s |
| ORM / migrations | Drizzle ORM + drizzle-kit | `@neondatabase/serverless` driver |
| Auth | **Better Auth** (email+password, `admin` plugin) | sessions in Neon, built-in rate limiting, no email provider |
| Files | **Vercel Blob (private)** or **Backblaze B2** (10 GB free, S3 API) | decided in Phase 0 — must support private files + presigned URLs |
| Cron | Vercel Cron (daily) | reminders only |
| Push | Web Push (VAPID) via `web-push` | iOS 16.4+ only when installed to Home Screen |
| Tests | Vitest | authorization tests for every route |
| Hosting | Vercel Hobby, `my-veicolo.vercel.app` | |

---

## 9. Data model

```
user / session / account     -- managed by Better Auth
  user: id, email, name, role (admin|user), banned, created_at, last_seen_at

password_reset_links         -- generated by admin, shared manually
  id, user_id, token_hash, expires_at, used_at, created_by

vehicles
  id, plate (unique), vin?, make, model, version, fuel, engine_cc, power_kw,
  euro_class, registration_date, color, photo_path, notes,
  lookup_id → plate_lookup, created_by, created_at, updated_at

vehicle_assignments
  vehicle_id, user_id, assigned_by, assigned_at   -- PK (vehicle_id, user_id)

plate_lookup                 -- paid API cache, one row per plate
  id, plate (unique), provider, response_json, normalized_json, fetched_at

api_call_log
  id, provider, plate, cost_eur, admin_id, ok, error?, created_at

deadlines
  id, vehicle_id, type (rca|bollo|revisione|tagliando|gomme|custom), label?,
  due_date, due_km?, recurrence (e.g. 1y|2y|6m|none),
  snoozed_until?, notes, updated_at

deadline_events              -- history of renewals
  id, deadline_id, done_date, previous_due_date, new_due_date,
  cost_eur?, company?, km?, document_id?, done_by, created_at

maintenance_entries
  id, vehicle_id, date, km, type, description, cost_eur, garage, created_by

documents
  id, vehicle_id, kind (libretto|polizza|fattura|altro), storage_path,
  mime, title, expires_at?, uploaded_by, uploaded_at

push_subscriptions
  id, user_id, endpoint (unique), keys_json, user_agent, created_at, last_ok_at

notification_log
  deadline_id, user_id, threshold (d30|d7|d1|d0|overdue-YYYY-MM-DD), sent_at

fuel_entries / expenses      (v2)
```

Authorization rules (enforced in the API, covered by tests):
- Admin → full access everywhere.
- Users: `vehicles`, `deadlines`, `deadline_events`, `maintenance_entries`, `documents` readable/writable only if a `vehicle_assignments` row exists for (vehicle, user).
- Users can't create/delete `vehicles`, can't touch `vehicle_assignments`, `plate_lookup`, `api_call_log`, other users.
- `push_subscriptions`: own rows only.
- Every vehicle-scoped route has a test asserting a non-assigned user gets 404.

Default deadline rules (editable, created automatically when the admin saves a vehicle):
- **Revisione**: first at 4 years from registration (end of month), then every 2 years.
- **Bollo**: yearly; month from registration, editable (region-dependent).
- **RCA**: yearly; user fills in actual expiry when the car is first assigned (prompted).

---

## 10. API (Hono)

```
/api/auth/*                         Better Auth (sign-up, sign-in, sign-out, session)
POST   /api/password-reset/:token   { password }  (public, one-time link)

# admin middleware
GET    /api/admin/users             → users + #vehicles + push status + last seen
PATCH  /api/admin/users/:id         { banned?, role? }
POST   /api/admin/users/:id/reset-link  → one-time URL to share
POST   /api/admin/lookup            { plate, force? }  → cached or paid lookup
POST   /api/admin/vehicles          { ...fields, lookupId, assignTo[] }
DELETE /api/admin/vehicles/:id
PUT    /api/admin/vehicles/:id/assignments  { userIds[] }
GET    /api/admin/costs?month=YYYY-MM

# authed middleware (scoped to assigned vehicles)
GET    /api/vehicles                → my vehicles (all, for admin)
GET    /api/vehicles/:id
PATCH  /api/vehicles/:id            (notes, photo, color…)
CRUD   /api/vehicles/:id/deadlines
POST   /api/deadlines/:id/renew     { doneDate?, newDueDate?, cost?, company?, km?, documentId? }
POST   /api/deadlines/:id/snooze    { days }
CRUD   /api/vehicles/:id/maintenance
CRUD   /api/vehicles/:id/documents  (+ presigned upload/download URLs)
POST   /api/push/subscribe          { subscription }
DELETE /api/push/subscribe          { endpoint }
POST   /api/push/test

# system
GET    /api/cron/reminders          Vercel Cron, protected by CRON_SECRET
GET    /api/calendar/:token.ics     (v2)
```

Notification action buttons (Android) call `/api/deadlines/:id/renew|snooze` directly from the service worker (session cookie is sent).
Plate lookup sits behind `PlateProvider.lookup(plate) → VehicleData` so providers can be swapped.

---

## 11. Phases

**Phase 0 — Spike (1–2 evenings)**
- [x] Scaffold the Turborepo (`apps/web`, `apps/api`, `packages/shared`, `packages/config`); build, test, typecheck green.
- [x] `vite-plugin-pwa` custom SW (precache, push, notification click → deep link, update prompt) + `/push-test` page.
- [x] Deploy to Vercel (root `apps/web`), set VAPID env vars, verify the `/api` function bundles `@my-veicolo/api`.
- [x] Verify Web Push on Android + installed iOS PWA from `*.vercel.app` (incl. "app closed" test).
- [x] Attach Neon via Marketplace (Frankfurt; functions pinned to `fra1`).
- [ ] Test 2–3 plate APIs on my plate; pick one, record decision here.
- [ ] Pick file storage: confirm Vercel Blob private access on Hobby, otherwise Backblaze B2.

**Phase 1 — Skeleton & auth**
- [x] `packages/db`: Drizzle schema + first migration; Neon client (prod), PGlite (dev + tests).
- [x] Better Auth: email+password, admin plugin, `ADMIN_EMAILS` bootstrap, DB-backed rate limiting, 60-day sliding sessions.
- [x] API: `createApp(getDeps)`, `authed` (cookie cache bypassed so bans apply immediately) + `adminOnly`, `canAccessVehicle`; `/me`, `/vehicles`, `/admin/users`, per-user push subscriptions.
- [x] Web: Accedi / Registrati (TanStack Form + shared Zod schemas, Italian errors), protected layout, waiting screen, admin users list, logout removes the device from push.
- [x] Tests: 20 API tests incl. cross-user access; end-to-end browser run of the full flow.
- [x] Apply the migration to Neon (dedicated database), set `BETTER_AUTH_SECRET` + `ADMIN_EMAILS` on Vercel, deploy, sign up as admin.

**Phase 2 — Admin panel & vehicles**
- [x] Migration 0001: plate lookup cache, API call log, reset links, more vehicle fields.
- [x] `PlateProvider` interface + `lookupPlate` (free cache per plate, `force` pays, monthly budget, every call logged, failures not charged). `fake` provider for dev/tests; production stays manual until a provider is chosen.
- [x] Admin UI: Utenti (detail: assign/unassign, reset link with copy/share, promote, suspend), Veicoli (add by plate or by hand, edit, assignments with push to new assignees, delete), Costi (month vs budget, latest calls).
- [x] Public "Reimposta password" page (one use, 24h, signs out all devices). Vehicle detail page for users.
- [x] Session cookie cache disabled: bans, resets and sign-outs apply immediately in the UI too.
- [x] 41 API tests; end-to-end browser run of the whole admin flow.
- [ ] ~~Choose a paid plate provider~~ **Postponed (2026-11-15):** specs come from the libretto (scan or by hand), deadlines from free official checks. The `PlateProvider` plumbing stays, switched off (`PLATE_PROVIDER` unset), in case typing specs gets tedious.

**Phase 3 — Deadlines, renewals, push** *(MVP done here)*
- Deadlines (revisione, bollo, RCA, tagliando, gomme, custom) with default generation from the registration date, status badges (rules in `packages/shared`).
- Renew/snooze flow + `deadline_events` history; "Ho fatto qualcosa" global entry point.
- **Official checks without scraping:** "Verifica sul sito ufficiale" opens the official page (plate pre-filled where possible); the user solves any captcha there, then types or **pastes** the result back and the app extracts the date(s). No captcha relay, no server-side scraping (ToS, fragility).
- Daily Vercel Cron + Web Push (stage-based thresholds 30/7/1/0 days, every 3 days overdue, dedupe log, banned users skipped), Android notification actions (renew / snooze).

**Phase 3b — Libretto scan**
- Photo of the libretto → **Tesseract.js on the device** (free, nothing leaves the phone) → parse by the harmonized field codes (A, B, D.1–D.3, E, P.1–P.3, V.9) → prefill the vehicle form for review. Owner fields (C.*) are never extracted. Language data self-hosted/cached by the service worker.

**Phase 4 — Maintenance, documents, offline**
- Maintenance log, document upload (presigned URLs), quick links.
- Persisted query cache for offline reads, update prompt, icons, dark mode.

**Phase 5 — Extras**
- Fuel/expenses, `.ics` feed, free revisione/RCA checks, passkeys, OCR, export.

---

## 12. iOS-specific notes
- Install via **Safari → Share → Add to Home Screen** (required for push).
- Push on iOS 16.4+ only for installed PWAs, after a user-initiated permission prompt (button, not on page load).
- No notification action buttons on iOS web push → tap opens `/renew/:id`.
- Storage may be evicted → server is the source of truth.
- Session cookie in an installed PWA is separate from Safari's → user logs in once inside the installed app.
- Onboarding screen after sign-up: "install to home screen → enable notifications" with screenshots.

---

## 13. Costs (estimate)
- Vercel Hobby: **€0** (personal, non-commercial use), incl. Turborepo remote cache.
- Neon free: **€0** (0.5 GB storage, plenty of compute hours for a few users; no inactivity pausing of the project).
- File storage: **€0** (Vercel Blob Hobby quota or Backblaze B2 10 GB free).
- Domain: **none** (`*.vercel.app`).
- Plate lookups: **~€0.05–1 per car, once**. Budget guard caps monthly spend.

---

## 14. Risks & open questions
- **Vercel Function bundling from a workspace package**: `apps/web/api/*` imports `@my-veicolo/api` (TS source) → verify in Phase 0 that Vercel bundles it; fallback: build `apps/api` to JS first (Turbo `dependsOn: ["^build"]`).
- **Open sign-up without email verification**: anyone with the URL can create an account, but gets no data; rate limiting + `SIGNUP_ENABLED` switch + ban. Admin should check who a user is before assigning a car.
- **Vercel Cron on Hobby** runs once/day with ~1h timing jitter → fine for reminders; if more precision is ever needed, trigger the endpoint from an external free cron (e.g. GitHub Actions schedule).
- **Neon cold start** (~0.5–1 s on first request after idle) → acceptable; the PWA shows cached data instantly anyway.
- **Authorization is app-level, not DB-level** → middlewares + one helper, every route tested for cross-user access.
- **iOS push reliability** → `.ics` feed as fallback in v2.
- **Scraping fragility / ToS** on government portals → link-out fallback always.
- **Privacy**: other people's documents & plates → private file storage, short-lived presigned URLs, no direct DB access from the browser.
