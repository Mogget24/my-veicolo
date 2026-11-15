import { z } from 'zod'
import { addMonths, addYears, daysBetween, endOfMonth, formatDateIt, isIsoDate, type IsoDate } from './dates'

export const DEADLINE_TYPES = ['revisione', 'bollo', 'rca', 'tagliando', 'gomme', 'custom'] as const
export type DeadlineType = (typeof DEADLINE_TYPES)[number]

/** Standard types exist at most once per vehicle; `custom` can repeat. */
export const STANDARD_DEADLINE_TYPES = DEADLINE_TYPES.filter((t) => t !== 'custom')

export const DEADLINE_LABELS: Record<DeadlineType, string> = {
  revisione: 'Revisione',
  bollo: 'Bollo',
  rca: 'Assicurazione RCA',
  tagliando: 'Tagliando',
  gomme: 'Cambio gomme',
  custom: 'Altro',
}

export const deadlineLabel = (d: { type: DeadlineType; label?: string | null }) => d.label?.trim() || DEADLINE_LABELS[d.type]

/** "Soon" window for badges, matching the first reminder. */
export const SOON_DAYS = 30

export type DeadlineStatus = 'unset' | 'ok' | 'soon' | 'today' | 'overdue'

export function deadlineStatus(dueDate: IsoDate | null, today: IsoDate): { status: DeadlineStatus; days: number | null } {
  if (!dueDate) return { status: 'unset', days: null }
  const days = daysBetween(today, dueDate)
  if (days < 0) return { status: 'overdue', days }
  if (days === 0) return { status: 'today', days }
  return { status: days <= SOON_DAYS ? 'soon' : 'ok', days }
}

/** Next seasonal tyre change (15 April / 15 November) strictly after `after`. */
export function nextTyreChange(after: IsoDate): IsoDate {
  const year = Number(after.slice(0, 4))
  const candidates = [`${year}-04-15`, `${year}-11-15`, `${year + 1}-04-15`]
  return candidates.find((c) => c > after)!
}

/**
 * Suggested new due date after a renewal (always editable in the UI):
 * - revisione: 2 years from when it was done, end of that month;
 * - bollo, RCA: 1 year after the previous expiry (the period does not move if paid late or early);
 * - tagliando: 1 year after it was done (km-based reminders are a later feature);
 * - gomme: next seasonal change;
 * - custom: its recurrence, if any.
 */
export function suggestNextDue(
  type: DeadlineType,
  opts: { doneDate: IsoDate; previousDue: IsoDate | null; recurrenceMonths?: number | null },
): IsoDate | null {
  const { doneDate, previousDue } = opts
  switch (type) {
    case 'revisione':
      return endOfMonth(addYears(doneDate, 2))
    case 'bollo':
    case 'rca':
      return addYears(previousDue ?? doneDate, 1)
    case 'tagliando':
      return addYears(doneDate, 1)
    case 'gomme':
      return nextTyreChange(doneDate)
    case 'custom':
      return opts.recurrenceMonths ? addMonths(doneDate, opts.recurrenceMonths) : null
  }
}

/**
 * Deadlines created with a new vehicle. Dates are estimates from the registration date
 * and are shown as "da verificare" until the user confirms them:
 * - revisione: first at 4 years (end of month), then every 2 years;
 * - bollo: yearly, end of the registration month;
 * - RCA: no date (only the policy knows it).
 */
export function defaultDeadlines(registrationDate: IsoDate | null, today: IsoDate): { type: DeadlineType; dueDate: IsoDate | null }[] {
  if (!registrationDate) {
    return [
      { type: 'revisione', dueDate: null },
      { type: 'bollo', dueDate: null },
      { type: 'rca', dueDate: null },
    ]
  }
  let revisione = endOfMonth(addYears(registrationDate, 4))
  while (revisione < today) revisione = endOfMonth(addYears(revisione, 2))

  let bollo = endOfMonth(`${today.slice(0, 4)}-${registrationDate.slice(5, 7)}-01`)
  if (bollo < today) bollo = endOfMonth(addYears(bollo, 1))

  return [
    { type: 'revisione', dueDate: revisione },
    { type: 'bollo', dueDate: bollo },
    { type: 'rca', dueDate: null },
  ]
}

/**
 * Which reminder applies `days` before (or after, if negative) a deadline. Stage-based, so a
 * cron run that is missed or delayed still sends the right reminder the next day:
 * 30..8 → d30, 7..2 → d7, 1 → d1, 0 → d0; overdue: one reminder per 3-day window (-1..-3, -4..-6, …).
 */
export function reminderStage(days: number): string | null {
  if (days > SOON_DAYS) return null
  if (days > 7) return 'd30'
  if (days > 1) return 'd7'
  if (days === 1) return 'd1'
  if (days === 0) return 'd0'
  return `o${Math.floor((-days - 1) / 3)}`
}

/** Notification body, gender-neutral in Italian (works for "la revisione" and "il bollo"). */
export function reminderBody(days: number, dueDate: IsoDate): string {
  const date = formatDateIt(dueDate)
  if (days > 1) return `Scadenza tra ${days} giorni (${date})`
  if (days === 1) return `Scadenza domani (${date})`
  if (days === 0) return `Scadenza oggi (${date})`
  return `In ritardo di ${-days} giorn${days === -1 ? 'o' : 'i'} (scadenza ${date})`
}

// --- API input schemas -------------------------------------------------------

const isoDate = z.string().refine(isIsoDate, 'Data non valida')

export const createDeadlineSchema = z.object({
  type: z.enum(DEADLINE_TYPES),
  label: z.string().trim().max(60, 'Massimo 60 caratteri').nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  recurrenceMonths: z.number().int().min(1).max(120).nullable().optional(),
  notes: z.string().trim().max(1_000).nullable().optional(),
})

export const updateDeadlineSchema = createDeadlineSchema.omit({ type: true }).partial()

export const renewDeadlineSchema = z.object({
  doneDate: isoDate,
  /** Omitted → suggestNextDue. null → no next date (e.g. one-off custom deadline). */
  newDueDate: isoDate.nullable().optional(),
  costEur: z.number().min(0, 'Importo non valido').max(100_000).nullable().optional(),
  company: z.string().trim().max(80).nullable().optional(),
  km: z.number().int().min(0).max(5_000_000).nullable().optional(),
  notes: z.string().trim().max(1_000).nullable().optional(),
})

export const snoozeDeadlineSchema = z.object({ days: z.number().int().min(1).max(30) })
