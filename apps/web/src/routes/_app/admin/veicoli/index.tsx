import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { buttonClass } from '../../../../components/Button'
import { Plate } from '../../../../components/Plate'
import { adminVehiclesQuery } from '../../../../lib/admin'

export const Route = createFileRoute('/_app/admin/veicoli/')({
  loader: ({ context }) => context.queryClient.query({ ...adminVehiclesQuery, staleTime: 'static' }),
  component: AdminVehicles,
})

function AdminVehicles() {
  const { data: vehicles = [] } = useQuery(adminVehiclesQuery)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Veicoli</h1>
          <p className="text-sm text-silver-400">{vehicles.length} in totale</p>
        </div>
        <Link to="/admin/veicoli/nuovo" className={buttonClass('primary', 'px-3 py-2 text-sm')}>
          + Aggiungi
        </Link>
      </div>

      {vehicles.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-silver-400">
          Nessun veicolo. Aggiungine uno partendo dalla targa.
        </p>
      )}

      <ul className="space-y-3">
        {vehicles.map((v) => (
          <li key={v.id}>
            <Link
              to="/admin/veicoli/$id"
              params={{ id: v.id }}
              className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-silver-700 active:bg-white/5"
            >
              <Plate value={v.plate} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{[v.make, v.model].filter(Boolean).join(' ') || 'Veicolo'}</p>
                <p className={`truncate text-xs ${v.assignees.length ? 'text-silver-400' : 'text-amber-300'}`}>
                  {v.assignees.length ? v.assignees.map((a) => a.name).join(', ') : 'Non assegnato'}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
