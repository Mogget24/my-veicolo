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
      <header className="flex items-center justify-between border-b border-line px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-silver-200">
          <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
          my-veicolo
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/push-test" className="text-silver-400 hover:text-silver-200" activeProps={{ className: 'text-silver-100 font-semibold' }}>
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
