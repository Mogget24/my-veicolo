import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { costsQuery, dateTimeFmt, euro } from '../../../lib/admin'
import { formatPlate } from '@my-veicolo/shared/plate'

export const Route = createFileRoute('/_app/admin/costi')({
  loader: ({ context }) => context.queryClient.query({ ...costsQuery, staleTime: 'static' }),
  component: Costs,
})

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })

function Costs() {
  const { data } = useQuery(costsQuery)
  if (!data) return null
  const pct = data.budgetEur > 0 ? Math.min(100, (data.spentEur / data.budgetEur) * 100) : 100
  const tone = pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-300' : 'bg-silver-300'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Costi ricerche targa</h1>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm capitalize text-silver-400">{monthFmt.format(new Date(`${data.month}-01T00:00:00Z`))}</p>
        <p className="text-3xl font-bold tabular-nums">
          {euro.format(data.spentEur)} <span className="text-base font-normal text-silver-400">di {euro.format(data.budgetEur)}</span>
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-silver-900" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-silver-400">
          {data.provider
            ? `Servizio: ${data.provider.id} · ${euro.format(data.provider.costEur)} a ricerca. Le targhe già cercate sono gratis.`
            : 'Nessun servizio targhe configurato: i dati si inseriscono a mano, senza costi.'}
        </p>
        <p className="text-xs text-silver-500">Il budget mensile si imposta con LOOKUP_MONTHLY_BUDGET_EUR su Vercel.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold text-silver-200">Ultime ricerche</h2>
        {data.calls.length === 0 && <p className="text-sm text-silver-500">Nessuna ricerca a pagamento finora.</p>}
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {data.calls.map((call) => (
            <li key={call.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono font-semibold tracking-wider">{formatPlate(call.plate)}</p>
                <p className="truncate text-xs text-silver-500">
                  {dateTimeFmt.format(new Date(call.createdAt))}
                  {call.error && ` · ${call.error}`}
                </p>
              </div>
              <span className={`shrink-0 tabular-nums ${call.ok ? 'text-silver-200' : 'text-red-300'}`}>
                {call.ok ? euro.format(call.costEur) : 'Errore'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
