import { eq, inArray } from 'drizzle-orm'
import { sendNotification, setVapidDetails, WebPushError } from 'web-push'
import type { Db } from '@my-veicolo/db/client'
import { pushSubscriptions } from '@my-veicolo/db/schema/app'
import type { PushPayload } from '@my-veicolo/shared/push'
import { requireEnv } from '../env'

/**
 * Applies the VAPID config. Returns an error message (safe to show: names the variable
 * and the reason, never a key value) instead of throwing.
 */
export function configureWebPush(): string | null {
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
 * as gone (404/410) are deleted. Call configureWebPush() first.
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

/** Best effort: notifies users, never throws (missing VAPID config or push errors are only logged). */
export async function notifyUsers(db: Db, userIds: string[], payload: PushPayload) {
  if (!userIds.length || configureWebPush()) return
  await Promise.all(userIds.map((id) => sendToUser(db, id, payload).catch((err) => console.error('notifyUsers', err))))
}
