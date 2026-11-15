import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { buttonClass } from '../../components/Button'
import { Plate } from '../../components/Plate'
import { DeadlineCard } from '../../components/DeadlineCard'
import { myDeadlinesQuery } from '../../lib/deadlines'
import { todayInRome } from '@my-veicolo/shared/dates'
import { deadlineStatus } from '@my-veicolo/shared/deadline'

const vehiclesQuery = queryOptions({
  queryKey: ['vehicles'],
  queryFn: async () => {
    const res = await api.vehicles.$get()
    if (!res.ok) throw new Error('Impossibile caricare i veicoli')
    return (await res.json()).vehicles
  },
})

export const Route = createFileRoute('/_app/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({ ...vehiclesQuery, staleTime: 'static' }),
      context.queryClient.query({ ...myDeadlinesQuery, staleTime: 'static' }),
    ]),
  component: Vehicles,
})

function Vehicles() {
  const { session } = Route.useRouteContext()
  const { data: vehicles = [] } = useQuery(vehiclesQuery)
  const { data: deadlines = [] } = useQuery(myDeadlinesQuery)
  const today = todayInRome()
  const urgent = deadlines.filter((d) => ['overdue', 'today', 'soon'].includes(deadlineStatus(d.dueDate, today).status))
  const withoutDate = deadlines.filter((d) => !d.dueDate).length
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
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h1 className="text-2xl font-bold">Da fare</h1>
          <Link to="/scadenze" className="text-sm text-silver-400 hover:text-silver-200">
            Tutte le scadenze →
          </Link>
        </div>
        {urgent.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-silver-400">Nessuna scadenza nei prossimi 30 giorni ✓</p>
        ) : (
          <ul className="space-y-2">
            {urgent.slice(0, 5).map((d) => (
              <li key={d.id}>
                <DeadlineCard deadline={d} showVehicle />
              </li>
            ))}
          </ul>
        )}
        {withoutDate > 0 && (
          <Link to="/scadenze" className="block rounded-2xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-200">
            {withoutDate === 1 ? '1 scadenza senza data: impostala' : `${withoutDate} scadenze senza data: impostale`} per ricevere i promemoria →
          </Link>
        )}
      </section>

      <h2 className="text-xl font-bold">{isAdmin ? 'Tutti i veicoli' : 'I miei veicoli'}</h2>
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
