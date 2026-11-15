import { Hono } from 'hono'
import { validate } from '../validate'
import { z } from 'zod'
import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import { pushSubscriptionSchema, type PushPayload } from '@my-veicolo/shared'
import { requireEnv } from '../env'

function configureWebPush() {
  setVapidDetails(
    requireEnv('VAPID_SUBJECT'),
    requireEnv('VAPID_PUBLIC_KEY'),
    requireEnv('VAPID_PRIVATE_KEY'),
  )
}

export const pushRoutes = new Hono()
  .get('/public-key', (c) => c.json({ publicKey: requireEnv('VAPID_PUBLIC_KEY') }))
  /**
   * Phase 0 spike only: sends a test notification to the subscription in the body.
   * Replaced in Phase 1 by an authed endpoint that uses stored subscriptions.
   */
  .post(
    '/test',
    validate('json', z.object({ subscription: pushSubscriptionSchema, delaySeconds: z.number().int().min(0).max(30).default(0) })),
    async (c) => {
      configureWebPush()
      const { subscription, delaySeconds } = c.req.valid('json')
      if (delaySeconds > 0) await new Promise((r) => setTimeout(r, delaySeconds * 1000))
      const payload: PushPayload = {
        title: 'my-veicolo',
        body: 'Notifica di prova: le notifiche funzionano 🎉',
        url: '/push-test',
        tag: 'test',
      }
      try {
        const res = await sendNotification(subscription, JSON.stringify(payload), { TTL: 60 })
        return c.json({ ok: true, status: res.statusCode })
      } catch (err) {
        const status = err instanceof WebPushError ? err.statusCode : 500
        return c.json({ ok: false, status, error: String(err) }, 502)
      }
    },
  )
