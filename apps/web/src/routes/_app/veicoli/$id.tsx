import { Link, createFileRoute } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { buttonClass } from '../../../components/Button'
import { Plate } from '../../../components/Plate'
import { VehicleDeadlines } from '../../../components/VehicleDeadlines'
import { vehicleDeadlinesQuery } from '../../../lib/deadlines'
import { dateFmt } from '../../../lib/admin'
import { api } from '../../../lib/api'
import { apiError } from '../../../lib/http'

const vehicleQuery = (id: string) =>
  queryOptions({
    queryKey: ['vehicles', id],
    queryFn: async () => {
      const res = await api.vehicles[':id'].$get({ param: { id } })
      if (!res.ok) throw await apiError(res, 'Veicolo non trovato')
      return (await res.json()).vehicle
    },
  })

export const Route = createFileRoute('/_app/veicoli/$id')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query({ ...vehicleQuery(params.id), staleTime: 'static' }),
      context.queryClient.query({ ...vehicleDeadlinesQuery(params.id), staleTime: 'static' }),
    ]),
  component: VehicleDetail,
})

function VehicleDetail() {
  const { id } = Route.useParams()
  const { session } = Route.useRouteContext()
  const { data: v } = useQuery(vehicleQuery(id))
  if (!v) return null

  const specs: [string, string | number | null][] = [
    ['Marca', v.make],
    ['Modello', v.model],
    ['Versione', v.version],
    ['Alimentazione', v.fuel],
    ['Cilindrata', v.engineCc ? `${v.engineCc} cc` : null],
    ['Potenza', v.powerKw ? `${v.powerKw} kW (${Math.round(v.powerKw * 1.35962)} CV)` : null],
    ['Classe Euro', v.euroClass],
    ['Immatricolazione', v.registrationDate ? dateFmt.format(new Date(v.registrationDate)) : null],
    ['Colore', v.color],
    ['Telaio', v.vin],
  ]
  const filled = specs.filter(([, value]) => value !== null && value !== '')

  return (
    <div className="space-y-4">
      <Link to="/" className="text-sm text-silver-400 hover:text-silver-200">
        ← Veicoli
      </Link>
      <div className="space-y-2">
        <Plate value={v.plate} size="lg" />
        <h1 className="text-2xl font-bold">{[v.make, v.model].filter(Boolean).join(' ') || 'Veicolo'}</h1>
        {v.version && <p className="text-silver-400">{v.version}</p>}
      </div>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold text-silver-200">Dati tecnici</h2>
        {filled.length === 0 ? (
          <p className="text-sm text-silver-500">Nessun dato inserito.</p>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {filled.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-silver-400">{label}</dt>
                <dd className="text-silver-100">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {v.notes && <p className="mt-4 whitespace-pre-line border-t border-line pt-3 text-sm text-silver-300">{v.notes}</p>}
      </section>

      <VehicleDeadlines vehicleId={v.id} />

      {session.user.role === 'admin' && (
        <Link to="/admin/veicoli/$id" params={{ id: v.id }} className={buttonClass('outline', 'w-full')}>
          Modifica (admin)
        </Link>
      )}
    </div>
  )
}
