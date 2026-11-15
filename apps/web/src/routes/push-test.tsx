import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '../components/Button'
import { getCurrentSubscription, isIOS, isPushSupported, isStandalone, sendTestPush, subscribeToPush } from '../lib/push'

export const Route = createFileRoute('/push-test')({ component: PushTest })

const currentPermission = () => ('Notification' in window ? Notification.permission : 'unsupported')

function PushTest() {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [permission, setPermission] = useState<string>(currentPermission)
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const ios = isIOS()
  const standalone = isStandalone()
  const supported = isPushSupported()
  const addLog = (msg: string) => setLog((l) => [`${new Date().toLocaleTimeString('it-IT')} — ${msg}`, ...l])

  useEffect(() => {
    getCurrentSubscription()
      .then(setSubscription)
      .catch((err) => addLog(`Errore: ${err instanceof Error ? err.message : String(err)}`))
  }, [])

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (err) {
      addLog(`Errore: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
      setPermission(currentPermission())
    }
  }

  const permissionLabel =
    permission === 'granted' ? '✅ concesso' : permission === 'denied' ? '❌ negato' : permission === 'unsupported' ? '—' : 'da chiedere'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prova notifiche</h1>

      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-4 text-sm dark:bg-slate-900">
        <dt>Dispositivo</dt>
        <dd>{ios ? 'iPhone / iPad' : 'Altro'}</dd>
        <dt>App installata</dt>
        <dd>{standalone ? '✅ sì' : '❌ no (aperta nel browser)'}</dd>
        <dt>Notifiche supportate</dt>
        <dd>{supported ? '✅ sì' : '❌ no'}</dd>
        <dt>Permesso</dt>
        <dd>{permissionLabel}</dd>
        <dt>Iscrizione</dt>
        <dd>{subscription ? '✅ attiva' : '—'}</dd>
      </dl>

      {ios && !standalone && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
          Su iPhone le notifiche funzionano solo se l'app è installata: in Safari tocca <strong>Condividi</strong> →{' '}
          <strong>Aggiungi alla schermata Home</strong>, poi apri my-veicolo dall'icona.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Button
          disabled={busy || !supported}
          onClick={() =>
            run(async () => {
              const sub = await subscribeToPush(addLog)
              setSubscription(sub)
              addLog('Notifiche attivate')
            })
          }
        >
          {subscription ? 'Notifiche attive ✓' : 'Attiva notifiche'}
        </Button>
        <Button
          variant="outline"
          disabled={busy || !subscription}
          onClick={() =>
            run(async () => {
              const res = await sendTestPush(subscription!)
              addLog(`Notifica inviata (stato ${res.status})`)
            })
          }
        >
          Invia notifica di prova
        </Button>
        <Button
          variant="outline"
          disabled={busy || !subscription}
          onClick={() =>
            run(async () => {
              addLog("Invio tra 10 secondi: chiudi l'app ora")
              const res = await sendTestPush(subscription!, 10)
              addLog(`Notifica inviata (stato ${res.status})`)
            })
          }
        >
          Invia tra 10 secondi (app chiusa)
        </Button>
        {!subscription && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            {supported
              ? "Tocca prima “Attiva notifiche” per abilitare l'invio di prova."
              : 'Questo browser non supporta le notifiche push.'}
          </p>
        )}
      </div>

      {log.length > 0 && (
        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
