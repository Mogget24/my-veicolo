import { describe, expect, it } from 'vitest'
import { addDays, addMonths, addYears, daysBetween, endOfMonth, formatDateIt, parseItalianDates, todayInRome } from '../src/dates'

describe('dates', () => {
  it('adds months clamping to the end of the month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28')
  })

  it('computes end of month and day differences', () => {
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
    expect(daysBetween('2026-03-28', '2026-03-31')).toBe(3)
    expect(daysBetween('2026-03-31', '2026-03-28')).toBe(-3)
    // across the DST change (29 March 2026)
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it("uses Rome's date, not UTC", () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Rome
    expect(todayInRome(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01')
    expect(todayInRome(new Date('2026-07-10T21:59:00Z'))).toBe('2026-07-10')
    expect(todayInRome(new Date('2026-07-10T22:01:00Z'))).toBe('2026-07-11')
  })

  it('formats and parses Italian dates', () => {
    expect(formatDateIt('2026-03-05')).toBe('05/03/2026')
    const pasted = `Esito: REGOLARE
      Data ultima revisione: 12/03/2025  Km: 45.210
      Polizza valida fino al 31-01-27, rinnovo 1.2.2027 — non valida 31/02/2026`
    expect(parseItalianDates(pasted)).toEqual(['2025-03-12', '2027-01-31', '2027-02-01'])
  })
})
