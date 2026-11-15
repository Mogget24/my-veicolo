import { createMiddleware } from 'hono/factory'
import type { AppEnv } from './context'

/**
 * Requires a valid session (banned users have none: the admin plugin revokes them).
 * The cookie cache is bypassed so a ban or sign-out takes effect immediately,
 * at the cost of one small DB query per API request.
 */
export const authed = createMiddleware<AppEnv>(async (c, next) => {
  const result = await c.var.deps.auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  })
  if (!result) return c.json({ error: 'Accesso richiesto' }, 401)
  c.set('user', result.user)
  c.set('session', result.session)
  await next()
})

/** Requires an admin. Use after `authed`. */
export const adminOnly = createMiddleware<AppEnv>(async (c, next) => {
  if (c.var.user.role !== 'admin') return c.json({ error: 'Riservato agli amministratori' }, 403)
  await next()
})
