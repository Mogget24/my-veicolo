import { describe, expect, it } from 'vitest'
import { deadlineStatus, defaultDeadlines, nextTyreChange, reminderBody, reminderStage, suggestNextDue } from '../src/deadline'

describe('deadline rules', () => {
  it('status and days', () => {
    expect(deadlineStatus(null, '2026-11-15')).toEqual({ status: 'unset', days: null })
    expect(deadlineStatus('2027-01-31', '2026-11-15')).toEqual({ status: 'ok', days: 77 })
    expect(deadlineStatus('2026-12-15', '2026-11-15')).toEqual({ status: 'soon', days: 30 })
    expect(deadlineStatus('2026-11-15', '2026-11-15')).toEqual({ status: 'today', days: 0 })
    expect(deadlineStatus('2026-11-10', '2026-11-15')).toEqual({ status: 'overdue', days: -5 })
  })

  it('suggests the next due date per type', () => {
    expect(suggestNextDue('revisione', { doneDate: '2026-03-12', previousDue: '2026-03-31' })).toBe('2028-03-31')
    // bollo/RCA keep their yearly period even if paid late
    expect(suggestNextDue('rca', { doneDate: '2026-02-10', previousDue: '2026-01-31' })).toBe('2027-01-31')
    expect(suggestNextDue('bollo', { doneDate: '2026-02-10', previousDue: null })).toBe('2027-02-10')
    expect(suggestNextDue('tagliando', { doneDate: '2026-06-01', previousDue: null })).toBe('2027-06-01')
    expect(suggestNextDue('gomme', { doneDate: '2026-11-10', previousDue: null })).toBe('2026-11-15')
    expect(suggestNextDue('custom', { doneDate: '2026-06-01', previousDue: null, recurrenceMonths: 6 })).toBe('2026-12-01')
    expect(suggestNextDue('custom', { doneDate: '2026-06-01', previousDue: null })).toBeNull()
  })

  it('tyre changes alternate April / November', () => {
    expect(nextTyreChange('2026-01-10')).toBe('2026-04-15')
    expect(nextTyreChange('2026-04-15')).toBe('2026-11-15')
    expect(nextTyreChange('2026-12-01')).toBe('2027-04-15')
  })

  it('default deadlines from the registration date', () => {
    // registered March 2021: first revisione March 2025 (past) → next March 2027
    expect(defaultDeadlines('2021-03-15', '2026-11-15')).toEqual([
      { type: 'revisione', dueDate: '2027-03-31' },
      { type: 'bollo', dueDate: '2027-03-31' },
      { type: 'rca', dueDate: null },
    ])
    // brand new car: first revisione after 4 years; bollo month already passed this year → next year
    expect(defaultDeadlines('2026-02-03', '2026-11-15')).toEqual([
      { type: 'revisione', dueDate: '2030-02-28' },
      { type: 'bollo', dueDate: '2027-02-28' },
      { type: 'rca', dueDate: null },
    ])
    expect(defaultDeadlines(null, '2026-11-15').every((d) => d.dueDate === null)).toBe(true)
  })

  it('reminder stages are robust to missed days', () => {
    expect(reminderStage(31)).toBeNull()
    expect([30, 20, 8].map(reminderStage)).toEqual(['d30', 'd30', 'd30'])
    expect([7, 3, 2].map(reminderStage)).toEqual(['d7', 'd7', 'd7'])
    expect(reminderStage(1)).toBe('d1')
    expect(reminderStage(0)).toBe('d0')
    expect([-1, -2, -3].map(reminderStage)).toEqual(['o0', 'o0', 'o0'])
    expect([-4, -6, -7].map(reminderStage)).toEqual(['o1', 'o1', 'o2'])
  })

  it('reminder text', () => {
    expect(reminderBody(7, '2026-03-31')).toBe('Scadenza tra 7 giorni (31/03/2026)')
    expect(reminderBody(1, '2026-03-31')).toBe('Scadenza domani (31/03/2026)')
    expect(reminderBody(0, '2026-03-31')).toBe('Scadenza oggi (31/03/2026)')
    expect(reminderBody(-1, '2026-03-31')).toBe('In ritardo di 1 giorno (scadenza 31/03/2026)')
    expect(reminderBody(-4, '2026-03-31')).toBe('In ritardo di 4 giorni (scadenza 31/03/2026)')
  })
})
