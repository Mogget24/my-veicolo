import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DEADLINE_LABELS, type DeadlineType } from '@my-veicolo/shared/deadline'
import { api } from '../lib/api'
import { vehicleDeadlinesQuery } from '../lib/deadlines'
import { apiError, errorText } from '../lib/http'
import { FormError } from './AuthCard'
import { Button } from './Button'
import { DeadlineCard } from './DeadlineCard'
import { TextField } from './TextField'

const OPTIONAL: DeadlineType[] = ['tagliando', 'gomme', 'custom']

/** Deadlines of one vehicle, with "add" for the optional ones (tagliando, gomme, custom). */
export function VehicleDeadlines({ vehicleId }: { vehicleId: string }) {
  const queryClient = useQueryClient()
  const { data: deadlines = [] } = useQuery(vehicleDeadlinesQuery(vehicleId))
  const [adding, setAdding] = useState(false)
  const [type, setType] = useState<DeadlineType>('tagliando')
  const [label, setLabel] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [recurrence, setRecurrence] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const existing = new Set(deadlines.map((d) => d.type))
  const addable = OPTIONAL.filter((t) => t === 'custom' || !existing.has(t))
  const missingStandard = !existing.has('revisione') || !existing.has('bollo') || !existing.has('rca')

  async function run(fn: () => Promise<Response>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fn()
      if (!res.ok) throw await apiError(res)
      await queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    if (type === 'custom' && !label.trim()) return setError('Dai un nome alla scadenza')
    const months = recurrence.trim() ? Number(recurrence) : null
    if (months !== null && (!Number.isInteger(months) || months < 1)) return setError('Ripetizione: numero di mesi')
    const ok = await run(() =>
      api.vehicles[':id'].deadlines.$post({
        param: { id: vehicleId },
        json: { type, label: type === 'custom' ? label.trim() : null, dueDate: dueDate || null, recurrenceMonths: months },
      }),
    )
    if (ok) {
      setAdding(false)
      setLabel('')
      setDueDate('')
      setRecurrence('')
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-silver-200">Scadenze</h2>
        {!adding && addable.length > 0 && (
          <Button
            variant="ghost"
            className="px-2 py-1 text-sm"
            onClick={() => {
              setType(addable[0]!)
              setAdding(true)
            }}
          >
            + Aggiungi
          </Button>
        )}
      </div>

      <ul className="space-y-2">
        {deadlines.map((d) => (
          <li key={d.id}>
            <DeadlineCard deadline={d} />
          </li>
        ))}
      </ul>

      {missingStandard && (
        <Button
          variant="outline"
          className="w-full"
          disabled={busy}
          onClick={() => run(() => api.vehicles[':id'].deadlines.defaults.$post({ param: { id: vehicleId } }))}
        >
          Aggiungi revisione, bollo e assicurazione
        </Button>
      )}

      {adding && (
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-silver-300">Tipo</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DeadlineType)}
              className="block w-full rounded-lg border border-silver-800 bg-bg px-3 py-2.5 text-silver-100 focus:border-silver-400 focus:outline-none"
            >
              {addable.map((t) => (
                <option key={t} value={t}>
                  {DEADLINE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          {type === 'custom' && <TextField label="Nome" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="es. Bollino blu" />}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Scadenza" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            {type === 'custom' && (
              <TextField label="Ogni (mesi)" inputMode="numeric" value={recurrence} onChange={(e) => setRecurrence(e.target.value)} placeholder="facoltativo" />
            )}
          </div>
          <FormError message={error} />
          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => setAdding(false)}>
              Annulla
            </Button>
            <Button className="flex-1" disabled={busy} onClick={add}>
              Aggiungi
            </Button>
          </div>
        </div>
      )}
      {!adding && <FormError message={error} />}
    </section>
  )
}
