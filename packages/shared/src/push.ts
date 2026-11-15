import { z } from 'zod'

/** Shape of PushSubscription.toJSON() sent by the browser. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

/** Payload the service worker expects in every push message. */
export const pushPayloadSchema = z.object({
  title: z.string(),
  body: z.string(),
  /** Path opened when the notification is tapped, e.g. /renew/123 */
  url: z.string().default('/'),
  tag: z.string().optional(),
})
export type PushPayload = z.infer<typeof pushPayloadSchema>
