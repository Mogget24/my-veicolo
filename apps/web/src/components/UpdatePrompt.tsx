import { useRegisterSW } from 'virtual:pwa-register/react'

/** Shows a banner when a new version of the app is available. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 flex items-center gap-3 rounded-xl bg-slate-900 p-4 text-sm text-white shadow-lg">
      <span className="flex-1">È disponibile una nuova versione.</span>
      <button className="rounded-lg px-3 py-1.5 text-slate-300" onClick={() => setNeedRefresh(false)}>
        Più tardi
      </button>
      <button className="rounded-lg bg-teal-600 px-3 py-1.5 font-medium" onClick={() => updateServiceWorker(true)}>
        Aggiorna
      </button>
    </div>
  )
}
