import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDateIt, parseItalianDates, todayInRome, type IsoDate } from '@my-veicolo/shared/dates'
import { deadlineLabel, deadlineStatus, suggestNextDue, type DeadlineType } from '@my-veicolo/shared/deadline'
import { formatPlate } from '@my-veicolo/shared/plate'
import { FormError } from '../../../components/AuthCard'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { Plate } from '../../../components/Plate'
import { TextField } from '../../../components/TextField'
import { dateTimeFmt, euro } from '../../../lib/admin'
import { api } from '../../../lib/api'
import { OFFICIAL_CHECKS, companyLabel, deadlineQuery, recordsKm, statusText, statusTone } from '../../../lib/deadlines'
import { apiError, errorText } from '../../../lib/http'

export const Route = createFileRoute('/_app/scadenze/$id')({
  loader: ({ context, params }) => context.queryClient.query({ ...deadlineQuery(params.id), staleTime: 'static' }),
  component: DeadlineDetail,
})

const REQUIRED = ['revisione', 'bollo', 'rca']

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-silver-200">{title}</h2>
      {children}
    </section>
  )
}

function DeadlineDetail() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useQuery(deadlineQuery(id))
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!data) return null
  const { deadline, vehicle, events } = data
  const today = todayInRome()
  const { status, days } = deadlineStatus(deadline.dueDate, today)
  const label = deadlineLabel(deadline)
  const check = OFFICIAL_CHECKS[deadline.type]

  async function run(fn: () => Promise<Response>, success: string) {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fn()
      if (!res.ok) throw await apiError(res)
      // Refresh first, so the confirmation appears together with the updated data.
      await queryClient.invalidateQueries({ queryKey: ['deadlines'] })
      setMessage({ ok: true, text: success })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setMessage({ ok: false, text: errorText(err) })
    } finally {
      setBusy(false)
    }
  }

  const setDueDate = (dueDate: IsoDate) =>
    run(() => api.deadlines[':id'].$patch({ param: { id }, json: { dueDate } }), `Scadenza impostata al ${formatDateIt(dueDate)}.`)

  return (
    <div className="space-y-4">
      <Link to="/veicoli/$id" params={{ id: vehicle.id }} className="text-sm text-silver-400 hover:text-silver-200">
        ← {[vehicle.make, vehicle.model].filter(Boolean).join(' ') || formatPlate(vehicle.plate)}
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{label}</h1>
          <Badge tone={statusTone(status)}>{statusText(status, days, deadline.dueDate)}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm text-silver-400">
          <Plate value={vehicle.plate} />
          <span>
            {deadline.dueDate ? `Scadenza ${formatDateIt(deadline.dueDate)}` : 'Nessuna data'}
            {deadline.snoozedUntil && deadline.snoozedUntil > today && ` · promemoria dal ${formatDateIt(deadline.snoozedUntil)}`}
          </span>
        </div>
      </div>

      {message &&
        (message.ok ? (
          <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200">
            {message.text}
          </p>
        ) : (
          <FormError message={message.text} />
        ))}

      {deadline.estimated && deadline.dueDate && (
        <div className="space-y-3 rounded-2xl border border-amber-800 bg-amber-950/40 p-4 text-sm text-amber-100">
          <p>
            Questa data è <strong>stimata</strong> dalla data di immatricolazione. Verificala{check ? ' sul sito ufficiale qui sotto' : ''} e
            confermala o correggila.
          </p>
          <Button variant="outline" className="w-full" disabled={busy} onClick={() => setDueDate(deadline.dueDate!)}>
            La data {formatDateIt(deadline.dueDate)} è giusta
          </Button>
        </div>
      )}

      {deadline.dueDate && (
        <RenewForm
          key={deadline.dueDate}
          deadline={deadline}
          busy={busy}
          onSubmit={(json) =>
            run(() => api.deadlines[':id'].renew.$post({ param: { id }, json }), json.newDueDate
              ? `Registrato! Prossima scadenza: ${formatDateIt(json.newDueDate)}.`
              : 'Registrato!')
          }
        />
      )}

      <Section title={deadline.dueDate ? 'Cambia data di scadenza' : 'Imposta la data di scadenza'}>
        <DateSetter key={deadline.dueDate ?? 'none'} initial={deadline.dueDate} busy={busy} onSave={setDueDate} />
      </Section>

      {check && (
        <Section title="Verifica sul sito ufficiale">
          <OfficialCheckPanel type={deadline.type} plate={vehicle.plate} busy={busy} onUseDate={setDueDate} />
        </Section>
      )}

      {deadline.dueDate && (
        <Section title="Ricordamelo più tardi">
          <p className="text-sm text-silver-400">Sospende i promemoria senza cambiare la scadenza.</p>
          <div className="flex gap-2">
            {[3, 7].map((d) => (
              <Button
                key={d}
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => run(() => api.deadlines[':id'].snooze.$post({ param: { id }, json: { days: d } }), `Ok, te lo ricordo tra ${d} giorni.`)}
              >
                Tra {d} giorni
              </Button>
            ))}
          </div>
        </Section>
      )}

      {events.length > 0 && (
        <Section title="Storico">
          <ul className="space-y-3 text-sm">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-silver-700 pl-3">
                <p className="text-silver-200">
                  {e.kind === 'renewed' ? `Fatto il ${formatDateIt(e.doneDate!)}` : 'Promemoria rimandato'}
                  {e.kind === 'renewed' && e.newDueDate && ` → nuova scadenza ${formatDateIt(e.newDueDate)}`}
                </p>
                <p className="text-xs text-silver-500">
                  {[
                    e.costEur !== null && euro.format(e.costEur),
                    e.company,
                    e.km !== null && `${e.km.toLocaleString('it-IT')} km`,
                    e.notes,
                    dateTimeFmt.format(new Date(e.createdAt)),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!REQUIRED.includes(deadline.type) && (
        <Button
          variant="danger"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`Eliminare la scadenza “${label}”?`)) return
            const res = await api.deadlines[':id'].$delete({ param: { id } })
            if (!res.ok) return setMessage({ ok: false, text: (await apiError(res)).message })
            await queryClient.invalidateQueries({ queryKey: ['deadlines'] })
            await navigate({ to: '/veicoli/$id', params: { id: vehicle.id } })
          }}
        >
          Elimina scadenza
        </Button>
      )}
    </div>
  )
}

type RenewInput = {
  doneDate: IsoDate
  newDueDate: IsoDate | null
  costEur: number | null
  company: string | null
  km: number | null
  notes: string | null
}

/** "Fatto": when it was done, the suggested next due date (editable) and optional details. */
function RenewForm({
  deadline,
  busy,
  onSubmit,
}: {
  deadline: { type: DeadlineType; dueDate: IsoDate | null; recurrenceMonths: number | null }
  busy: boolean
  onSubmit: (input: RenewInput) => void
}) {
  const today = todayInRome()
  const [doneDate, setDoneDate] = useState(today)
  const suggestion = (done: IsoDate) =>
    suggestNextDue(deadline.type, { doneDate: done, previousDue: deadline.dueDate, recurrenceMonths: deadline.recurrenceMonths }) ?? ''
  const [newDueDate, setNewDueDate] = useState(suggestion(today))
  const [touchedDue, setTouchedDue] = useState(false)
  const [cost, setCost] = useState('')
  const [company, setCompany] = useState('')
  const [km, setKm] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Keep the suggestion in sync with the done date until the user edits it.
  useEffect(() => {
    if (!touchedDue && doneDate) setNewDueDate(suggestion(doneDate))
  }, [doneDate])

  const submit = () => {
    const costValue = cost.trim() ? Number(cost.replace(',', '.')) : null
    const kmValue = km.trim() ? Number(km.replace(/\./g, '')) : null
    if (!doneDate) return setError('Inserisci la data')
    if (costValue !== null && (!Number.isFinite(costValue) || costValue < 0)) return setError('Importo non valido')
    if (kmValue !== null && (!Number.isInteger(kmValue) || kmValue < 0)) return setError('Km non validi')
    setError(null)
    onSubmit({
      doneDate,
      newDueDate: newDueDate || null,
      costEur: costValue,
      company: company.trim() || null,
      km: kmValue,
      notes: notes.trim() || null,
    })
  }

  return (
    <Section title="Fatto ✓">
      <p className="text-sm text-silver-400">Già fatto? Registralo: la prossima scadenza è proposta in automatico e puoi cambiarla.</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Fatto il" type="date" value={doneDate} max={today} onChange={(e) => setDoneDate(e.target.value)} />
        <TextField
          label="Prossima scadenza"
          type="date"
          value={newDueDate}
          onChange={(e) => {
            setTouchedDue(true)
            setNewDueDate(e.target.value)
          }}
        />
        <TextField label="Costo (€)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="facoltativo" />
        {recordsKm.includes(deadline.type) && (
          <TextField label="Km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder="facoltativo" />
        )}
      </div>
      {companyLabel[deadline.type] && (
        <TextField label={companyLabel[deadline.type]!} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="facoltativo" />
      )}
      <TextField label="Note" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="facoltativo" />
      <FormError message={error} />
      <Button className="w-full" disabled={busy} onClick={submit}>
        {busy ? 'Salvataggio…' : 'Registra'}
      </Button>
    </Section>
  )
}

function DateSetter({ initial, busy, onSave }: { initial: IsoDate | null; busy: boolean; onSave: (d: IsoDate) => void }) {
  const [value, setValue] = useState(initial ?? '')
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <TextField label="Data" type="date" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button disabled={busy || !value || value === initial} onClick={() => onSave(value)}>
        Salva
      </Button>
    </div>
  )
}

/**
 * Opens the official page (copying the plate when the site can't receive it) and lets the user
 * paste the result back: dates found in the text become one-tap "use this date" buttons.
 */
function OfficialCheckPanel({
  type,
  plate,
  busy,
  onUseDate,
}: {
  type: DeadlineType
  plate: string
  busy: boolean
  onUseDate: (d: IsoDate) => void
}) {
  const check = OFFICIAL_CHECKS[type]!
  const [pasted, setPasted] = useState('')
  const [copied, setCopied] = useState(false)
  const dates = parseItalianDates(pasted)

  // For the revisione the page shows when it was *done*: the due date is 2 years later.
  const proposal = (d: IsoDate) =>
    type === 'revisione'
      ? { due: suggestNextDue('revisione', { doneDate: d, previousDue: null })!, text: `Revisione del ${formatDateIt(d)}` }
      : { due: d, text: `Scadenza ${formatDateIt(d)}` }

  return (
    <div className="space-y-3">
      <p className="text-sm text-silver-400">{check.hint}</p>
      <a
        href={check.url(plate)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (!check.prefillsPlate) navigator.clipboard?.writeText(plate).then(() => setCopied(true), () => {})
        }}
        className="flex items-center justify-between gap-3 rounded-lg border border-silver-500 px-4 py-3 text-silver-200 transition hover:bg-white/5 active:scale-[0.97] active:bg-white/10"
      >
        <span>{check.title}</span>
        <span aria-hidden>↗</span>
      </a>
      {copied && <p className="text-xs text-silver-400">Targa {formatPlate(plate)} copiata: incollala nel modulo.</p>}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-silver-300">Incolla qui il risultato (o scrivi la data)</span>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={3}
          placeholder="es. Data ultima revisione: 12/03/2025"
          className="block w-full rounded-lg border border-silver-800 bg-bg px-3 py-2.5 text-sm text-silver-100 placeholder:text-silver-600 focus:border-silver-400 focus:outline-none focus:ring-2 focus:ring-silver-400/30"
        />
      </label>
      {pasted && dates.length === 0 && <p className="text-xs text-silver-500">Nessuna data trovata (formato gg/mm/aaaa).</p>}
      <div className="flex flex-col gap-2">
        {dates.map((d) => {
          const p = proposal(d)
          return (
            <Button key={d} variant="outline" disabled={busy} onClick={() => onUseDate(p.due)}>
              {p.text} → scadenza {formatDateIt(p.due)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
