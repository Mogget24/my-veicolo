import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { todayInRome } from '@my-veicolo/shared/dates'
import { deadlineStatus } from '@my-veicolo/shared/deadline'
import { DeadlineCard } from '../../../components/DeadlineCard'
import { myDeadlinesQuery } from '../../../lib/deadlines'

export const Route = createFileRoute('/_app/scadenze/')({
  loader: ({ context }) => context.queryClient.query({ ...myDeadlinesQuery, staleTime: 'static' }),
  component: Deadlines,
})

/** "Ho fatto qualcosa": every deadline of my vehicles, grouped by urgency. */
function Deadlines() {
  const { data: deadlines = [] } = useQuery(myDeadlinesQuery)
  const today = todayInRome()
  const withStatus = deadlines.map((d) => ({ d, ...deadlineStatus(d.dueDate, today) }))

  const groups = [
    { title: 'In ritardo', items: withStatus.filter((x) => x.status === 'overdue' || x.status === 'today') },
    { title: 'Prossimi 30 giorni', items: withStatus.filter((x) => x.status === 'soon') },
    { title: 'Più avanti', items: withStatus.filter((x) => x.status === 'ok') },
    { title: 'Da impostare', items: withStatus.filter((x) => x.status === 'unset') },
  ].filter((g) => g.items.length)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Scadenze</h1>
        <p className="text-sm text-silver-400">Hai rinnovato qualcosa? Tocca la scadenza e premi “Fatto”.</p>
      </div>
      {deadlines.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-silver-400">
          Nessuna scadenza: arriveranno quando ti verrà assegnato un veicolo.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.title} className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-silver-400">{g.title}</h2>
          <ul className="space-y-2">
            {g.items.map(({ d }) => (
              <li key={d.id}>
                <DeadlineCard deadline={d} showVehicle />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
