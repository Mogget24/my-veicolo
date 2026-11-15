import { Link, Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { UpdatePrompt } from '../components/UpdatePrompt'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: () => <p className="p-4">Pagina non trovata.</p>,
})

function RootLayout() {
  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <Link to="/" className="text-lg font-semibold text-teal-700 dark:text-teal-400">
          my-veicolo
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/push-test" activeProps={{ className: 'font-semibold' }}>
            Notifiche
          </Link>
        </nav>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
      <UpdatePrompt />
    </div>
  )
}
