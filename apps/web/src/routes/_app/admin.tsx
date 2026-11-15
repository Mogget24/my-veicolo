import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'

/** Admin area layout: guard + section tabs. */
export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== 'admin') throw redirect({ to: '/' })
  },
  component: AdminLayout,
})

const tab =
  'flex-1 rounded-md px-3 py-1.5 text-center text-sm text-silver-400 transition-colors hover:text-silver-100 active:bg-white/5'
const tabActive = { className: 'bg-surface text-silver-50 font-semibold shadow-sm' }

function AdminLayout() {
  return (
    <div className="space-y-5">
      <nav className="flex gap-1 rounded-lg border border-line bg-bg p-1">
        <Link to="/admin" className={tab} activeProps={tabActive} activeOptions={{ exact: true }}>
          Utenti
        </Link>
        <Link to="/admin/veicoli" className={tab} activeProps={tabActive}>
          Veicoli
        </Link>
        <Link to="/admin/costi" className={tab} activeProps={tabActive}>
          Costi
        </Link>
      </nav>
      <Outlet />
    </div>
  )
}
