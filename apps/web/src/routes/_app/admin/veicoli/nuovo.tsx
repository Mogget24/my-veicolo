import { useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatPlate, normalizePlate } from '@my-veicolo/shared/plate'
import type { VehicleData } from '@my-veicolo/shared/vehicle'
import { AssigneePicker } from '../../../../components/AssigneePicker'
import { FormError } from '../../../../components/AuthCard'
import { Badge } from '../../../../components/Badge'
import { Button } from '../../../../components/Button'
import { TextField } from '../../../../components/TextField'
import { VehicleForm } from '../../../../components/VehicleForm'
import { adminUsersQuery, costsQuery, euro } from '../../../../lib/admin'
import { api } from '../../../../lib/api'
import { apiError, errorText } from '../../../../lib/http'

export const Route = createFileRoute('/_app/admin/veicoli/nuovo')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.query({ ...costsQuery, staleTime: 'static' }),
      context.queryClient.query({ ...adminUsersQuery, staleTime: 'static' }),
    ]),
  component: NewVehicle,
})

type Draft = {
  plate: string
  data: Partial<VehicleData>
  lookupId: string | null
  /** What the admin should know about where the data came from. */
  origin: { kind: 'manual' } | { kind: 'cache' } | { kind: 'provider'; costEur: number }
}

function NewVehicle() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: costs } = useQuery(costsQuery)
  const { data: users = [] } = useQuery(adminUsersQuery)
  const [plate, setPlate] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [assignTo, setAssignTo] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const provider = costs?.provider ?? null
  const remaining = costs ? costs.budgetEur - costs.spentEur : 0
  const normalized = normalizePlate(plate)

  async function lookup(force = false) {
    if (normalized.length < 5) return setError('Inserisci una targa valida')
    if (force && provider && !confirm(`Una nuova ricerca costa ${euro.format(provider.costEur)}. Continuare?`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.admin.plates.lookup.$post({ json: { plate: normalized, force } })
      if (!res.ok) throw await apiError(res, 'Ricerca non riuscita')
      const result = await res.json()
      setDraft({
        plate: result.plate,
        data: result.data,
        lookupId: result.lookupId,
        origin: result.source === 'cache' ? { kind: 'cache' } : { kind: 'provider', costEur: result.costEur },
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'costs'] })
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/admin/veicoli" className="text-sm text-silver-400 hover:text-silver-200">
        ← Veicoli
      </Link>
      <h1 className="text-2xl font-bold">Nuovo veicolo</h1>

      {!draft ? (
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <TextField
            label="Targa"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && provider && void lookup()}
            placeholder="AB 123 CD"
            autoCapitalize="characters"
            autoComplete="off"
            className="font-mono text-lg tracking-wider"
          />
          {provider ? (
            <p className="text-sm text-silver-400">
              La prima ricerca di una targa costa {euro.format(provider.costEur)}; le successive sono gratis. Budget rimasto
              questo mese: {euro.format(Math.max(remaining, 0))}.
            </p>
          ) : (
            <p className="text-sm text-amber-300">Nessun servizio targhe configurato: i dati vanno inseriti a mano.</p>
          )}
          <FormError message={error} />
          <div className="flex flex-col gap-2">
            {provider && (
              <Button disabled={busy || normalized.length < 5} onClick={() => void lookup()}>
                {busy ? 'Ricerca in corso…' : 'Cerca dati dalla targa'}
              </Button>
            )}
            <Button
              variant={provider ? 'ghost' : 'primary'}
              disabled={normalized.length < 5}
              onClick={() => {
                setError(null)
                setDraft({ plate: normalized, data: {}, lookupId: null, origin: { kind: 'manual' } })
              }}
            >
              Inserisci i dati a mano
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-lg font-bold tracking-wider">{formatPlate(draft.plate)}</p>
            {draft.origin.kind === 'cache' && <Badge tone="success">Dati dalla cache · gratis</Badge>}
            {draft.origin.kind === 'provider' && <Badge tone="warning">Ricerca a pagamento · {euro.format(draft.origin.costEur)}</Badge>}
            {draft.origin.kind === 'manual' && <Badge>Inserimento manuale</Badge>}
          </div>
          {draft.origin.kind === 'cache' && provider && (
            <button className="text-xs text-silver-400 underline underline-offset-4" disabled={busy} onClick={() => void lookup(true)}>
              Dati vecchi o sbagliati? Rifai la ricerca (a pagamento)
            </button>
          )}
          {existingId && (
            <p className="text-sm">
              <Link to="/admin/veicoli/$id" params={{ id: existingId }} className="text-silver-200 underline underline-offset-4">
                Apri il veicolo esistente
              </Link>
            </p>
          )}
          <VehicleForm
            key={draft.lookupId ?? 'manual'}
            initial={{ ...draft.data, plate: draft.plate }}
            editablePlate={draft.origin.kind === 'manual'}
            submitLabel="Salva veicolo"
            onSubmit={async ({ plate: formPlate, ...data }) => {
              setExistingId(null)
              const res = await api.admin.vehicles.$post({
                json: { ...data, plate: draft.origin.kind === 'manual' ? formPlate : draft.plate, lookupId: draft.lookupId, assignTo },
              })
              if (res.status === 409) {
                const body = (await res.clone().json()) as { id?: string }
                if (body.id) setExistingId(body.id)
              }
              if (!res.ok) throw await apiError(res, 'Salvataggio non riuscito')
              const { vehicle } = (await res.json()) as { vehicle: { id: string } }
              await queryClient.invalidateQueries({ queryKey: ['admin'] })
              await queryClient.invalidateQueries({ queryKey: ['vehicles'] })
              await navigate({ to: '/admin/veicoli/$id', params: { id: vehicle.id } })
            }}
          >
            <AssigneePicker users={users} value={assignTo} onChange={setAssignTo} />
          </VehicleForm>
          <Button variant="ghost" className="w-full" onClick={() => setDraft(null)}>
            Cambia targa
          </Button>
        </section>
      )}
    </div>
  )
}
