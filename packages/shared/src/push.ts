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
  /** Path opened when the notification is tapped, e.g. /scadenze/123 */
  url: z.string().default('/'),
  tag: z.string().optional(),
  /** Set on deadline reminders: enables the Android action buttons (renew / snooze). */
  deadlineId: z.string().optional(),
})
export type PushPayload = z.infer<typeof pushPayloadSchema>

/** Notification action buttons (Android; iOS ignores actions and only opens `url`). */
export const DEADLINE_ACTIONS = [
  { action: 'renew', title: '✅ Fatto' },
  { action: 'snooze', title: '⏰ Tra 3 giorni' },
] as const
export const SNOOZE_FROM_NOTIFICATION_DAYS = 3
