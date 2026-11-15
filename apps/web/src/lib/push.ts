import { api } from './api'
import { apiError } from './http'

export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    )
  })
}

/** Resolves with the active SW registration, or fails instead of hanging forever. */
function serviceWorkerReady(): Promise<ServiceWorkerRegistration> {
  return withTimeout(
    navigator.serviceWorker.ready,
    10_000,
    'Il service worker non si è attivato. Ricarica la pagina e riprova.',
  )
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const reg = await serviceWorkerReady()
  return reg.pushManager.getSubscription()
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Iscrizione non valida')
  const res = await api.push.subscribe.$post({
    json: { subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } },
  })
  if (!res.ok) throw await apiError(res, 'Impossibile registrare il dispositivo')
}

/**
 * Enables notifications on this device for the logged-in user.
 * Must be called from a user gesture (required on iOS). `onStep` reports progress for the UI.
 */
export async function subscribeToPush(onStep: (msg: string) => void = () => {}): Promise<PushSubscription> {
  if (Notification.permission === 'default') {
    onStep('Richiesta del permesso… (se non compare, controlla l’icona 🔔 nella barra degli indirizzi)')
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Permesso per le notifiche negato')

  onStep('Attesa del service worker…')
  const reg = await serviceWorkerReady()
  let sub = await reg.pushManager.getSubscription()

  if (!sub) {
    onStep('Richiesta della chiave al server…')
    const res = await withTimeout(api.push['public-key'].$get(), 10_000, 'Il server non risponde')
    if (!res.ok) throw new Error('Impossibile ottenere la chiave pubblica dal server')
    const { publicKey } = await res.json()

    onStep('Iscrizione al servizio push…')
    sub = await withTimeout(
      reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }),
      15_000,
      'Il servizio push del browser non risponde',
    )
  }

  onStep('Registrazione del dispositivo…')
  await saveSubscription(sub)
  return sub
}

/** Re-sends an existing browser subscription to the server (it may belong to a previous user). */
export async function syncSubscription() {
  const sub = await getCurrentSubscription()
  if (sub && Notification.permission === 'granted') await saveSubscription(sub)
  return sub
}

/** Removes this device from the current user (server and browser). Used on logout. */
export async function unsubscribeThisDevice() {
  const sub = await getCurrentSubscription().catch(() => null)
  if (!sub) return
  await api.push.unsubscribe.$post({ json: { endpoint: sub.endpoint } }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

export async function sendTestPush(delaySeconds = 0) {
  const res = await api.push.test.$post({ json: { delaySeconds } })
  if (!res.ok) throw await apiError(res, 'Invio fallito')
  return res.json()
}
