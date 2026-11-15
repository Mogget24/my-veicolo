import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { pushSubscriptions } from '@my-veicolo/db/schema/app'
import { pushSubscriptionSchema, type PushPayload } from '@my-veicolo/shared/push'
import { APP_NAME } from '@my-veicolo/shared/brand'
import type { AppEnv } from '../context'
import { authed } from '../middleware'
import { requireEnv } from '../env'
import { validate } from '../validate'
import { configureWebPush, sendToUser } from '../push/send'

export const pushRoutes = new Hono<AppEnv>()
  .get('/public-key', (c) => c.json({ publicKey: requireEnv('VAPID_PUBLIC_KEY') }))
  /** Saves this device for the current user. A device that changes user moves to the new one. */
  .post('/subscribe', authed, validate('json', z.object({ subscription: pushSubscriptionSchema })), async (c) => {
    const { db } = c.var.deps
    const { endpoint, keys } = c.req.valid('json').subscription
    const values = {
      userId: c.var.user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: c.req.header('user-agent') ?? null,
    }
    await db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values })
    return c.json({ ok: true as const })
  })
  /** Removes this device (only if it belongs to the current user). Called on logout. */
  .post('/unsubscribe', authed, validate('json', z.object({ endpoint: z.url() })), async (c) => {
    const { db } = c.var.deps
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, c.req.valid('json').endpoint), eq(pushSubscriptions.userId, c.var.user.id)))
    return c.json({ ok: true as const })
  })
  /** Sends a test notification to all devices of the current user. */
  .post(
    '/test',
    authed,
    validate('json', z.object({ delaySeconds: z.number().int().min(0).max(30).default(0) })),
    async (c) => {
      const configError = configureWebPush()
      if (configError) return c.json({ error: configError }, 500)

      const { delaySeconds } = c.req.valid('json')
      if (delaySeconds > 0) await new Promise((r) => setTimeout(r, delaySeconds * 1000))

      const result = await sendToUser(c.var.deps.db, c.var.user.id, {
        title: APP_NAME,
        body: 'Notifica di prova: le notifiche funzionano 🎉',
        url: '/notifiche',
        tag: 'test',
      })
      if (result.sent === 0 && result.removed === 0 && result.failed === 0) {
        return c.json({ error: 'Nessun dispositivo registrato: attiva prima le notifiche' }, 409)
      }
      return c.json(result)
    },
  )
