import { Link } from '@tanstack/react-router'
import { formatDateIt, todayInRome, type IsoDate } from '@my-veicolo/shared/dates'
import { deadlineLabel, deadlineStatus, type DeadlineType } from '@my-veicolo/shared/deadline'
import { statusText, statusTone } from '../lib/deadlines'
import { Badge } from './Badge'
import { Plate } from './Plate'

export type DeadlineLike = {
  id: string
  type: DeadlineType
  label: string | null
  dueDate: IsoDate | null
  estimated: boolean
  snoozedUntil: IsoDate | null
  vehicle?: { plate: string; make: string | null; model: string | null }
}

/** One deadline as a tappable row: opens /scadenze/$id (details, "Fatto", official check). */
export function DeadlineCard({ deadline, showVehicle = false }: { deadline: DeadlineLike; showVehicle?: boolean }) {
  const today = todayInRome()
  const { status, days } = deadlineStatus(deadline.dueDate, today)
  const snoozed = deadline.snoozedUntil && deadline.snoozedUntil > today

  return (
    <Link
      to="/scadenze/$id"
      params={{ id: deadline.id }}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-silver-700 active:bg-white/5"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{deadlineLabel(deadline)}</span>
          {showVehicle && deadline.vehicle && <Plate value={deadline.vehicle.plate} />}
        </div>
        <p className="text-sm text-silver-400">
          {deadline.dueDate ? `Scadenza ${formatDateIt(deadline.dueDate)}` : 'Inserisci la data per ricevere i promemoria'}
          {deadline.estimated && deadline.dueDate && <span className="text-amber-300"> · stimata, da verificare</span>}
          {snoozed && ` · promemoria dal ${formatDateIt(deadline.snoozedUntil!)}`}
        </p>
      </div>
      <Badge tone={statusTone(status)}>{statusText(status, days, deadline.dueDate)}</Badge>
    </Link>
  )
}
