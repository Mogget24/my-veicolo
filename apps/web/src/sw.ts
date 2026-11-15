/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import type { PushPayload } from '@my-veicolo/shared/push'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> }

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
  let payload: PushPayload = { title: 'my-veicolo', body: 'Hai una nuova notifica', url: '/' }
  try {
    if (event.data) payload = { ...payload, ...(event.data.json() as Partial<PushPayload>) }
  } catch {
    if (event.data) payload.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/pwa-192x192.png',
      // Monochrome silhouette: Android draws the badge from its alpha channel only.
      badge: '/badge-96.png',
      data: { url: payload.url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data as { url?: string } | null)?.url ?? '/'
  const url = new URL(target, self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client = windows.find((w) => w.url.startsWith(self.location.origin))
      if (client) {
        await client.focus()
        await client.navigate(url)
      } else {
        await self.clients.openWindow(url)
      }
    })(),
  )
})
