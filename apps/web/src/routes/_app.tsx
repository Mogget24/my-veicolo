import { useEffect, useState } from 'react'
import { Link, Outlet, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { authClient, sessionQuery } from '../lib/auth'
import { APP_NAME } from '@my-veicolo/shared/brand'
import { syncSubscription, unsubscribeThisDevice } from '../lib/push'

/** Pathless layout: every route below it requires a session. */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.query(sessionQuery)
    if (!session) throw redirect({ to: '/accedi', search: { redirect: location.href } })
    return { session }
  },
  component: AppLayout,
})

const navLink = 'rounded-md px-2 py-1 text-silver-400 transition-colors hover:text-silver-100 active:bg-white/5'
const navActive = { className: 'text-silver-50 font-semibold' }

function AppLayout() {
  const { data: session } = useQuery(sessionQuery)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const isAdmin = session?.user.role === 'admin'

  // If this browser already has a push subscription (e.g. from a previous user), attach it to the current one.
  useEffect(() => {
    syncSubscription().catch(() => {})
  }, [session?.user.id])

  async function signOut() {
    setSigningOut(true)
    await unsubscribeThisDevice()
    await authClient.signOut()
    queryClient.clear()
    await navigate({ to: '/accedi' })
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-silver-200">
            <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
            {APP_NAME}
          </Link>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="rounded-md px-2 py-1 text-sm text-silver-400 transition-colors hover:text-silver-100 active:bg-white/5 disabled:opacity-50"
          >
            {signingOut ? 'Uscita…' : 'Esci'}
          </button>
        </div>
        <nav className="flex gap-2 px-2 pb-2 text-sm">
          <Link to="/" className={navLink} activeProps={navActive} activeOptions={{ exact: true }}>
            Veicoli
          </Link>
          <Link to="/scadenze" className={navLink} activeProps={navActive}>
            Scadenze
          </Link>
          <Link to="/notifiche" className={navLink} activeProps={navActive}>
            Notifiche
          </Link>
          {isAdmin && (
            <Link to="/admin" className={navLink} activeProps={navActive}>
              Admin
            </Link>
          )}
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  )
}
