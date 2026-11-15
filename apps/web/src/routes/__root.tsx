import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { UpdatePrompt } from '../components/UpdatePrompt'
import { buttonClass } from '../components/Button'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <UpdatePrompt />
    </>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-sm space-y-4 p-8 text-center">
      <p className="text-lg font-medium">Pagina non trovata</p>
      <Link to="/" className={buttonClass('outline')}>
        Torna alla home
      </Link>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto max-w-sm space-y-4 p-8 text-center">
      <p className="text-lg font-medium">Qualcosa è andato storto</p>
      <p className="text-sm text-silver-400">{error instanceof Error ? error.message : String(error)}</p>
      <button className={buttonClass('outline')} onClick={reset}>
        Riprova
      </button>
    </div>
  ),
})
