import { createPgliteDb, type PgliteDb } from '@my-veicolo/db/pglite'
import { vehicleAssignments, vehicles } from '@my-veicolo/db/schema/app'
import type { Db } from '@my-veicolo/db/client'
import { createAuth, type AuthOptions } from '../src/auth'
import { createApp } from '../src/app'
import type { AppConfig } from '../src/context'
import { createFakeProvider, type PlateProvider } from '../src/plates/provider'

export const ORIGIN = 'http://localhost:5173'
export const ADMIN_EMAIL = 'admin@test.it'
export const SECOND_ADMIN_EMAIL = 'capo@test.it'

/**
 * An app on an in-memory PGlite database with all migrations applied.
 * Pass `db` to build another app (e.g. different auth options) on the same database:
 * each PGlite instance is memory-hungry, so keep one per test file and `close()` it in afterAll.
 */
export async function createTestApp(
  overrides: Partial<AuthOptions> = {},
  existingDb?: PgliteDb,
  extra: { plates?: PlateProvider | null; config?: Partial<AppConfig> } = {},
) {
  const db = existingDb ?? (await createPgliteDb())
  const auth = createAuth(db, {
    baseURL: ORIGIN,
    secret: 'test-secret-test-secret-test-secret-123',
    adminEmails: [ADMIN_EMAIL, SECOND_ADMIN_EMAIL],
    signUpEnabled: true,
    rateLimit: false,
    ...overrides,
  })
  const deps = {
    db,
    auth,
    plates: extra.plates === undefined ? createFakeProvider(0.5) : extra.plates,
    config: { appOrigin: ORIGIN, lookupMonthlyBudgetEur: 1, ...extra.config },
  }
  const app = createApp(() => deps)

  /** JSON request as the browser would send it (Origin set, optional session cookie). */
  const request = (path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) =>
    app.request(path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })

  /** Signs up and returns the session cookie. */
  async function signUp(email: string, password = 'password-sicura-1') {
    const res = await request('/api/auth/sign-up/email', { body: { email, password, name: email.split('@')[0] } })
    if (!res.ok) throw new Error(`sign-up failed (${res.status}): ${await res.text()}`)
    return sessionCookie(res)
  }

  const close = () => db.$client.close()

  return { app, db, auth, request, signUp, close }
}

export function sessionCookie(res: Response): string {
  const cookies = res.headers.getSetCookie().map((c) => c.split(';')[0])
  if (!cookies.length) throw new Error('no session cookie')
  return cookies.join('; ')
}

export async function createVehicle(db: Db, plate: string, assignTo: string[] = []) {
  const [v] = await db.insert(vehicles).values({ plate, make: 'Fiat', model: 'Panda' }).returning()
  if (!v) throw new Error('insert failed')
  if (assignTo.length) await db.insert(vehicleAssignments).values(assignTo.map((userId) => ({ vehicleId: v.id, userId })))
  return v
}

export async function json<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T
}
