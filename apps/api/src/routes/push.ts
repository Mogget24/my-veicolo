import { Hono } from 'hono'
import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import { pushSubscriptions } from '@my-veicolo/db/schema/app'
import type { Db } from '@my-veicolo/db/client'
import { pushSubscriptionSchema, type PushPayload } from '@my-veicolo/shared/push'
import type { AppEnv } from '../context'
import { authed } from '../middleware'
import { requireEnv } from '../env'
import { validate } from '../validate'

/**
 * Applies the VAPID config. Returns an error message (safe to show: names the variable
 * and the reason, never a key value) instead of throwing a generic 500.
 */
function configureWebPush(): string | null {
  try {
    setVapidDetails(requireEnv('VAPID_SUBJECT'), requireEnv('VAPID_PUBLIC_KEY'), requireEnv('VAPID_PRIVATE_KEY'))
    return null
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('VAPID config error:', msg)
    if (msg.startsWith("Variabile d'ambiente mancante")) return msg
    if (/subject/i.test(msg)) return "VAPID_SUBJECT non valido: deve essere 'mailto:indirizzo@email' o un URL https"
    if (/public key/i.test(msg)) return 'VAPID_PUBLIC_KEY non valida (rigenerala con pnpm vapid)'
    if (/private key/i.test(msg)) return 'VAPID_PRIVATE_KEY non valida (rigenerala con pnpm vapid)'
    return `Configurazione notifiche non valida: ${msg}`
  }
}

/**
 * Sends `payload` to every device of `userId`. Subscriptions the push service reports
 * as gone (404/410) are deleted. Reused by the reminders cron in Phase 3.
 */
export async function sendToUser(db: Db, userId: string, payload: PushPayload) {
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  const gone: string[] = []
  const ok: string[] = []
  let failed = 0

  await Promise.all(
    subs.map(async (s) => {
      try {
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
          TTL: 60 * 60 * 24,
        })
        ok.push(s.id)
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) gone.push(s.id)
        else {
          failed++
          console.error('Push send failed', err)
        }
      }
    }),
  )

  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone))
  if (ok.length) await db.update(pushSubscriptions).set({ lastOkAt: new Date() }).where(inArray(pushSubscriptions.id, ok))
  return { sent: ok.length, failed, removed: gone.length }
}

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
        title: 'my-veicolo',
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
