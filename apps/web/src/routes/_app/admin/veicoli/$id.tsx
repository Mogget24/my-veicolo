import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPlate } from '@my-veicolo/shared/plate'
import { AssigneePicker } from '../../../../components/AssigneePicker'
import { FormError } from '../../../../components/AuthCard'
import { Button } from '../../../../components/Button'
import { Plate } from '../../../../components/Plate'
import { VehicleForm } from '../../../../components/VehicleForm'
import { adminUsersQuery, adminVehicleQuery, setAssignees } from '../../../../lib/admin'
import { api } from '../../../../lib/api'
import { apiError, errorText } from '../../../../lib/http'

export const Route = createFileRoute('/_app/admin/veicoli/$id')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query({ ...adminVehicleQuery(params.id), staleTime: 'static' }),
      context.queryClient.query({ ...adminUsersQuery, staleTime: 'static' }),
    ]),
  component: EditVehicle,
})

function EditVehicle() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useQuery(adminVehicleQuery(id))
  const { data: users = [] } = useQuery(adminUsersQuery)
  const [assignees, setLocalAssignees] = useState<string[]>([])
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const savedIds = data?.assignees.map((a) => a.id) ?? []
  // Reset the picker to the saved state whenever fresh data arrives.
  useEffect(() => setLocalAssignees(savedIds), [data])

  if (!data) return null
  const { vehicle } = data
  const assigneesChanged = assignees.length !== savedIds.length || assignees.some((a) => !savedIds.includes(a))

  const refresh = () =>
    Promise.all([queryClient.invalidateQueries({ queryKey: ['admin'] }), queryClient.invalidateQueries({ queryKey: ['vehicles'] })])

  async function run(fn: () => Promise<string>) {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ ok: true, text: await fn() })
      await refresh()
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/admin/veicoli" className="text-sm text-silver-400 hover:text-silver-200">
        ← Veicoli
      </Link>
      <div className="flex items-center gap-3">
        <Plate value={vehicle.plate} size="lg" />
        <h1 className="min-w-0 truncate text-xl font-bold">{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Veicolo'}</h1>
      </div>

      {message &&
        (message.ok ? (
          <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200">
            {message.text}
          </p>
        ) : (
          <FormError message={message.text} />
        ))}

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <AssigneePicker users={users} value={assignees} onChange={setLocalAssignees} />
        <Button
          className="w-full"
          disabled={busy || !assigneesChanged}
          onClick={() =>
            run(async () => {
              const r = await setAssignees(vehicle.id, assignees)
              return r.added ? `Assegnazioni salvate: ${r.added} nuov${r.added === 1 ? 'o utente avvisato' : 'i utenti avvisati'} con una notifica.` : 'Assegnazioni salvate.'
            })
          }
        >
          Salva assegnazioni
        </Button>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-semibold text-silver-200">Dati del veicolo</h2>
        <VehicleForm
          key={vehicle.updatedAt}
          initial={vehicle}
          submitLabel="Salva modifiche"
          onSubmit={async ({ plate: _plate, ...changes }) => {
            const res = await api.admin.vehicles[':id'].$patch({ param: { id: vehicle.id }, json: changes })
            if (!res.ok) throw await apiError(res, 'Salvataggio non riuscito')
            setMessage({ ok: true, text: 'Dati salvati.' })
            await refresh()
          }}
        />
      </section>

      <section className="space-y-2 rounded-2xl border border-red-900/60 p-4">
        <h2 className="font-semibold text-red-300">Elimina veicolo</h2>
        <p className="text-sm text-silver-400">Rimuove il veicolo e le sue assegnazioni per tutti gli utenti. Non si può annullare.</p>
        <Button
          variant="danger"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Eliminare definitivamente ${formatPlate(vehicle.plate)}?`)) return
            setBusy(true)
            const res = await api.admin.vehicles[':id'].$delete({ param: { id: vehicle.id } })
            if (!res.ok) {
              setBusy(false)
              return setMessage({ ok: false, text: (await apiError(res, 'Eliminazione non riuscita')).message })
            }
            await refresh()
            await navigate({ to: '/admin/veicoli' })
          }}
        >
          Elimina
        </Button>
      </section>
    </div>
  )
}
