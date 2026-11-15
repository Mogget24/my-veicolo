import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { buttonClass } from '../../components/Button'
import { Plate } from '../../components/Plate'

const vehiclesQuery = queryOptions({
  queryKey: ['vehicles'],
  queryFn: async () => {
    const res = await api.vehicles.$get()
    if (!res.ok) throw new Error('Impossibile caricare i veicoli')
    return (await res.json()).vehicles
  },
})

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) => context.queryClient.query({ ...vehiclesQuery, staleTime: 'static' }),
  component: Vehicles,
})

function Vehicles() {
  const { session } = Route.useRouteContext()
  const { data: vehicles = [] } = useQuery(vehiclesQuery)
  const isAdmin = session.user.role === 'admin'
  const firstName = session.user.name.split(' ')[0]

  if (vehicles.length === 0) {
    return (
      <div className="space-y-6 pt-6 text-center">
        <img src="/icon.svg" alt="" className="mx-auto size-20 rounded-3xl opacity-80" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Ciao {firstName}!</h1>
          {isAdmin ? (
            <p className="text-silver-400">
              Non ci sono ancora veicoli. Aggiungili per targa dal pannello Admin.
            </p>
          ) : (
            <p className="text-silver-400">
              Nessun veicolo assegnato per ora. L’amministratore ti assegnerà i tuoi veicoli a breve.
            </p>
          )}
        </div>
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 text-left text-sm">
          <p className="font-medium text-silver-200">Nel frattempo</p>
          <p className="text-silver-400">
            Attiva le notifiche: ti avviseremo prima delle scadenze (revisione, bollo, assicurazione…).
          </p>
          <Link to="/notifiche" className={buttonClass('primary', 'w-full')}>
            Attiva le notifiche
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{isAdmin ? 'Tutti i veicoli' : 'I miei veicoli'}</h1>
      <ul className="space-y-3">
        {vehicles.map((v) => (
          <li key={v.id}>
            <Link
              to="/veicoli/$id"
              params={{ id: v.id }}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-silver-700 active:bg-white/5"
            >
              <Plate value={v.plate} />
              <div className="min-w-0">
                <p className="truncate font-medium">{[v.make, v.model].filter(Boolean).join(' ') || 'Veicolo'}</p>
                {v.version && <p className="truncate text-sm text-silver-400">{v.version}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
