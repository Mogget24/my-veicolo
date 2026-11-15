import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createNeonDb } from '@my-veicolo/db/client'
import { authOptionsFromEnv, createAuth } from './auth'
import type { AppEnv, Deps } from './context'
import { lookupBudgetFromEnv, requireEnv } from './env'
import { plateProviderFromEnv } from './plates/provider'
import { adminRoutes } from './routes/admin'
import { cronRoutes } from './routes/cron'
import { deadlineRoutes, vehicleDeadlineRoutes } from './routes/deadlines'
import { meRoutes } from './routes/me'
import { passwordResetRoutes } from './routes/password-reset'
import { pushRoutes } from './routes/push'
import { vehicleRoutes } from './routes/vehicles'

/**
 * Builds the API. `getDeps` is called per request (and may memoize), so production
 * creates the Neon client lazily while dev/tests inject PGlite.
 */
export function createApp(getDeps: () => Deps) {
  const app = new Hono<AppEnv>()
    .basePath('/api')
    .use(async (c, next) => {
      c.set('deps', getDeps())
      await next()
    })
    .on(['GET', 'POST'], '/auth/*', (c) => c.var.deps.auth.handler(c.req.raw))
    .get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }))
    .route('/me', meRoutes)
    .route('/vehicles', vehicleRoutes)
    .route('/vehicles', vehicleDeadlineRoutes)
    .route('/deadlines', deadlineRoutes)
    .route('/admin', adminRoutes)
    .route('/push', pushRoutes)
    .route('/password-reset', passwordResetRoutes)
    .route('/cron', cronRoutes)

  app.notFound((c) => c.json({ error: 'Risorsa non trovata' }, 404))
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse()
    console.error(err)
    return c.json({ error: 'Errore interno del server' }, 500)
  })

  return app
}

let prodDeps: Deps | undefined

/** Production dependencies (Neon + env config), created on first request. */
function productionDeps(): Deps {
  if (!prodDeps) {
    const db = createNeonDb(requireEnv('DATABASE_URL'))
    const authOptions = authOptionsFromEnv()
    prodDeps = {
      db,
      auth: createAuth(db, authOptions),
      plates: plateProviderFromEnv(),
      config: { appOrigin: authOptions.baseURL, lookupMonthlyBudgetEur: lookupBudgetFromEnv() },
    }
  }
  return prodDeps
}

/** The app served by the Vercel Function. */
export const app = createApp(productionDeps)

export type AppType = typeof app
