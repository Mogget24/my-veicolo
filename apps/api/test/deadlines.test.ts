import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { addYears, todayInRome } from '@my-veicolo/shared/dates'
import { ADMIN_EMAIL, createTestApp, createVehicle, json } from './helpers'

type Deadline = { id: string; type: string; dueDate: string | null; estimated: boolean; snoozedUntil: string | null }

describe('deadlines', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let admin: string, anna: string, bruno: string, annaId: string
  let carId: string
  beforeAll(async () => {
    t = await createTestApp()
    admin = await t.signUp(ADMIN_EMAIL)
    anna = await t.signUp('anna@test.it')
    bruno = await t.signUp('bruno@test.it')
    annaId = (await json(await t.request('/api/me', { cookie: anna }))).user.id
    const res = await t.request('/api/admin/vehicles', {
      cookie: admin,
      body: { plate: 'AB123CD', registrationDate: '2021-03-15', assignTo: [annaId] },
    })
    carId = (await json(res)).vehicle.id
  })
  afterAll(() => t.close())

  const list = async (cookie: string) =>
    (await json<{ deadlines: Deadline[] }>(await t.request(`/api/vehicles/${carId}/deadlines`, { cookie }))).deadlines
  const byType = async (type: string) => (await list(anna)).find((d) => d.type === type)!

  it('a new vehicle gets revisione, bollo and RCA (dates estimated from the registration)', async () => {
    const ds = await list(anna)
    expect(ds.map((d) => d.type).sort()).toEqual(['bollo', 'rca', 'revisione'])
    const revisione = ds.find((d) => d.type === 'revisione')!
    expect(revisione.estimated).toBe(true)
    expect(revisione.dueDate! >= todayInRome()).toBe(true)
    expect(revisione.dueDate!.slice(5, 7)).toBe('03')
    expect(ds.find((d) => d.type === 'rca')).toMatchObject({ dueDate: null, estimated: false })
  })

  it('only assigned users (and admins) can see or change them', async () => {
    const rca = await byType('rca')
    expect((await t.request(`/api/vehicles/${carId}/deadlines`, { cookie: bruno })).status).toBe(404)
    expect((await t.request(`/api/deadlines/${rca.id}`, { cookie: bruno })).status).toBe(404)
    expect((await t.request(`/api/deadlines/${rca.id}`, { method: 'PATCH', cookie: bruno, body: { dueDate: '2027-01-31' } })).status).toBe(404)
    expect((await t.request(`/api/deadlines/${rca.id}/renew`, { cookie: bruno, body: { doneDate: '2026-11-15' } })).status).toBe(404)
    expect((await t.request(`/api/deadlines/${rca.id}/snooze`, { cookie: bruno, body: { days: 3 } })).status).toBe(404)
    expect((await json(await t.request('/api/deadlines', { cookie: bruno }))).deadlines).toEqual([])
    expect((await json(await t.request('/api/deadlines', { cookie: anna }))).deadlines).toHaveLength(3)
    expect((await t.request(`/api/deadlines/${rca.id}`, { cookie: admin })).status).toBe(200)
  })

  it('setting or confirming a date by hand clears the estimate flag', async () => {
    const revisione = await byType('revisione')
    const res = await t.request(`/api/deadlines/${revisione.id}`, { method: 'PATCH', cookie: anna, body: { dueDate: '2027-03-31' } })
    expect((await json(res)).deadline).toMatchObject({ dueDate: '2027-03-31', estimated: false })
  })

  it('renewing the insurance keeps its yearly period and records the history', async () => {
    const rca = await byType('rca')
    await t.request(`/api/deadlines/${rca.id}`, { method: 'PATCH', cookie: anna, body: { dueDate: '2027-01-31' } })
    const res = await t.request(`/api/deadlines/${rca.id}/renew`, {
      cookie: anna,
      body: { doneDate: '2027-01-20', costEur: 420.5, company: 'Assicurazioni Prova' },
    })
    expect(res.status).toBe(200)
    expect((await json(res)).deadline).toMatchObject({ dueDate: '2028-01-31' })

    const detail = await json(await t.request(`/api/deadlines/${rca.id}`, { cookie: anna }))
    expect(detail.vehicle.plate).toBe('AB123CD')
    expect(detail.events).toMatchObject([
      { kind: 'renewed', doneDate: '2027-01-20', previousDueDate: '2027-01-31', newDueDate: '2028-01-31', costEur: 420.5, company: 'Assicurazioni Prova' },
    ])
  })

  it('renewal date can be overridden; revisione suggestion is 2 years, end of month', async () => {
    const revisione = await byType('revisione')
    const suggested = await json(await t.request(`/api/deadlines/${revisione.id}/renew`, { cookie: anna, body: { doneDate: '2027-03-10' } }))
    expect(suggested.deadline.dueDate).toBe('2029-03-31')
    const custom = await json(
      await t.request(`/api/deadlines/${revisione.id}/renew`, { cookie: anna, body: { doneDate: '2027-03-10', newDueDate: '2029-02-28' } }),
    )
    expect(custom.deadline.dueDate).toBe('2029-02-28')
  })

  it('snooze postpones reminders without moving the due date', async () => {
    const bollo = await byType('bollo')
    const res = await json(await t.request(`/api/deadlines/${bollo.id}/snooze`, { cookie: anna, body: { days: 3 } }))
    expect(res.deadline.dueDate).toBe(bollo.dueDate)
    expect(res.deadline.snoozedUntil > todayInRome()).toBe(true)
    // a new date ends the snooze
    const patched = await json(
      await t.request(`/api/deadlines/${bollo.id}`, { method: 'PATCH', cookie: anna, body: { dueDate: addYears(bollo.dueDate!, 1) } }),
    )
    expect(patched.deadline.snoozedUntil).toBeNull()
  })

  it('custom deadlines can be added and deleted; standard ones are unique and required', async () => {
    const created = await t.request(`/api/vehicles/${carId}/deadlines`, {
      cookie: anna,
      body: { type: 'custom', label: 'Bollino blu', dueDate: '2027-06-30', recurrenceMonths: 12 },
    })
    expect(created.status).toBe(201)
    const { deadline } = await json(created)
    expect((await t.request(`/api/vehicles/${carId}/deadlines`, { cookie: anna, body: { type: 'rca' } })).status).toBe(409)
    expect((await t.request(`/api/deadlines/${deadline.id}`, { method: 'DELETE', cookie: anna })).status).toBe(200)
    expect((await t.request(`/api/deadlines/${(await byType('rca')).id}`, { method: 'DELETE', cookie: anna })).status).toBe(409)
  })

  it('missing standard deadlines can be generated for older vehicles', async () => {
    const old = await createVehicle(t.db, 'ZZ999ZZ', [annaId])
    const first = await json(await t.request(`/api/vehicles/${old.id}/deadlines/defaults`, { cookie: anna, body: {} }))
    expect(first.created).toBe(3)
    const again = await json(await t.request(`/api/vehicles/${old.id}/deadlines/defaults`, { cookie: anna, body: {} }))
    expect(again.created).toBe(0)
  })
})
