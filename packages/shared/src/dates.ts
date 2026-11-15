/**
 * Calendar dates as "YYYY-MM-DD" strings (no time, no timezone), matching Postgres `date`.
 * All math is done in UTC on the date parts, so DST and timezones never shift a day.
 */
export type IsoDate = string

const pad = (n: number) => String(n).padStart(2, '0')

export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))

function parts(s: IsoDate) {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number]
  return { y, m, d }
}

const fromUtc = (date: Date): IsoDate => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Adds months, clamping the day to the end of the target month (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: IsoDate, n: number): IsoDate {
  const { y, m, d } = parts(s)
  const total = y * 12 + (m - 1) + n
  const ty = Math.floor(total / 12)
  const tm = (total % 12) + 1
  return `${ty}-${pad(tm)}-${pad(Math.min(d, daysInMonth(ty, tm)))}`
}

export const addYears = (s: IsoDate, n: number) => addMonths(s, n * 12)

export function addDays(s: IsoDate, n: number): IsoDate {
  const { y, m, d } = parts(s)
  return fromUtc(new Date(Date.UTC(y, m - 1, d + n)))
}

export function endOfMonth(s: IsoDate): IsoDate {
  const { y, m } = parts(s)
  return `${y}-${pad(m)}-${pad(daysInMonth(y, m))}`
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const a = parts(from)
  const b = parts(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

/** Today's date in Italy (the app's users), whatever the server or device timezone. */
export function todayInRome(now = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** "2026-03-31" → "31/03/2026". */
export function formatDateIt(s: IsoDate): string {
  const { y, m, d } = parts(s)
  return `${pad(d)}/${pad(m)}/${y}`
}

/**
 * Finds Italian-style dates (dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy, also with 2-digit years)
 * in free text, e.g. pasted from an official check page. Invalid dates are skipped.
 */
export function parseItalianDates(text: string): IsoDate[] {
  const found = new Set<IsoDate>()
  for (const match of text.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    const d = Number(match[1])
    const m = Number(match[2])
    let y = Number(match[3])
    if (match[3]!.length === 2) y += y < 70 ? 2000 : 1900
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) continue
    found.add(`${y}-${pad(m)}-${pad(d)}`)
  }
  return [...found]
}
