import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '../../../components/Badge'
import { adminUsersQuery, dateFmt } from '../../../lib/admin'

export const Route = createFileRoute('/_app/admin/')({
  loader: ({ context }) => context.queryClient.query({ ...adminUsersQuery, staleTime: 'static' }),
  component: Users,
})

function Users() {
  const { data: users = [] } = useQuery(adminUsersQuery)
  const waiting = users.filter((u) => u.vehicles === 0 && u.role !== 'admin' && !u.banned).length

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
          <li key={u.id}>
            <Link
              to="/admin/utenti/$id"
              params={{ id: u.id }}
              className="block space-y-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-silver-700 active:bg-white/5"
            >
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
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
