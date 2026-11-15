import { createFileRoute, redirect } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'

const usersQuery = queryOptions({
  queryKey: ['admin', 'users'],
  queryFn: async () => {
    const res = await api.admin.users.$get()
    if (!res.ok) throw new Error('Impossibile caricare gli utenti')
    return (await res.json()).users
  },
})

export const Route = createFileRoute('/_app/admin')({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== 'admin') throw redirect({ to: '/' })
  },
  loader: ({ context }) => context.queryClient.query({ ...usersQuery, staleTime: 'static' }),
  component: Admin,
})

const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })

function Admin() {
  const { data: users = [] } = useQuery(usersQuery)
  const waiting = users.filter((u) => u.vehicles === 0 && u.role !== 'admin').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Utenti</h1>
        <p className="text-sm text-silver-400">
          {users.length} registrati{waiting > 0 && ` · ${waiting} in attesa di un veicolo`}
        </p>
      </div>

      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id} className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="truncate text-sm text-silver-400">{u.email}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                {u.role === 'admin' && <Badge>Admin</Badge>}
                {u.banned && <Badge tone="danger">Sospeso</Badge>}
              </div>
            </div>
            <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-400">
              <div>
                <dt className="inline">Veicoli: </dt>
                <dd className={u.vehicles === 0 ? 'inline text-amber-300' : 'inline text-silver-200'}>{u.vehicles}</dd>
              </div>
              <div>
                <dt className="inline">Notifiche: </dt>
                <dd className="inline text-silver-200">
                  {u.pushDevices > 0 ? `${u.pushDevices} dispositiv${u.pushDevices === 1 ? 'o' : 'i'}` : 'non attive'}
                </dd>
              </div>
              <div>
                <dt className="inline">Iscritto il </dt>
                <dd className="inline text-silver-200">{dateFmt.format(new Date(u.createdAt))}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-silver-500">Aggiunta veicoli e assegnazioni arrivano nella fase 2.</p>
    </div>
  )
}

function Badge({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'danger' }) {
  const cls = tone === 'danger' ? 'border-red-800 bg-red-950 text-red-200' : 'border-silver-700 bg-silver-900 text-silver-200'
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>
}
