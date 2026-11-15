/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { DEADLINE_ACTIONS, SNOOZE_FROM_NOTIFICATION_DAYS, type PushPayload } from '@my-veicolo/shared/push'
import { APP_NAME } from '@my-veicolo/shared/brand'
import { formatDateIt, todayInRome } from '@my-veicolo/shared/dates'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> }

type NotificationData = { url?: string; deadlineId?: string }

const ICON = '/pwa-192x192.png'
// Monochrome silhouette: Android draws the badge from its alpha channel only.
const BADGE = '/badge-96.png'

// --- Offline shell -----------------------------------------------------------
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
if (import.meta.env.PROD) {
  registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }))
}

// The update prompt in the app sends this when the user accepts the new version.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

// --- Push --------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload: PushPayload = { title: APP_NAME, body: 'Hai una nuova notifica', url: '/' }
  try {
    if (event.data) payload = { ...payload, ...(event.data.json() as Partial<PushPayload>) }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  const options: NotificationOptions & { actions?: { action: string; title: string }[] } = {
    body: payload.body,
    tag: payload.tag,
    icon: ICON,
    badge: BADGE,
    data: { url: payload.url, deadlineId: payload.deadlineId } satisfies NotificationData,
  }
  // Action buttons (Android Chrome); other platforms ignore them and just open `url`.
  if (payload.deadlineId) options.actions = DEADLINE_ACTIONS.map((a) => ({ ...a }))

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

async function openUrl(url: string) {
  const target = new URL(url, self.location.origin).href
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  const client = windows.find((w) => w.url.startsWith(self.location.origin))
  if (client) {
    await client.focus()
    await client.navigate(target)
  } else {
    await self.clients.openWindow(target)
  }
}

/** Calls the API with the user's session cookie; false if not possible (offline, logged out…). */
async function post(path: string, body: unknown): Promise<Response | null> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.ok ? res : null
  } catch {
    return null
  }
}

async function handleAction(action: string, data: NotificationData, title: string) {
  const id = data.deadlineId!
  if (action === 'renew') {
    const res = await post(`/api/deadlines/${id}/renew`, { doneDate: todayInRome() })
    if (!res) return openUrl(data.url ?? `/scadenze/${id}`)
    const { deadline } = (await res.json()) as { deadline: { dueDate: string | null } }
    return self.registration.showNotification(`${title} ✓`, {
      body: deadline.dueDate ? `Registrato. Prossima scadenza: ${formatDateIt(deadline.dueDate)}` : 'Registrato.',
      tag: `deadline-${id}`,
      icon: ICON,
      badge: BADGE,
      data: { url: `/scadenze/${id}` } satisfies NotificationData,
    })
  }
  if (action === 'snooze') {
    const res = await post(`/api/deadlines/${id}/snooze`, { days: SNOOZE_FROM_NOTIFICATION_DAYS })
    if (!res) return openUrl(data.url ?? `/scadenze/${id}`)
    return self.registration.showNotification(title, {
      body: `Ok, te lo ricordo tra ${SNOOZE_FROM_NOTIFICATION_DAYS} giorni.`,
      tag: `deadline-${id}`,
      icon: ICON,
      badge: BADGE,
      data: { url: `/scadenze/${id}` } satisfies NotificationData,
    })
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as NotificationData

  if (event.action && data.deadlineId) {
    event.waitUntil(handleAction(event.action, data, event.notification.title))
    return
  }
  event.waitUntil(openUrl(data.url ?? '/'))
})
