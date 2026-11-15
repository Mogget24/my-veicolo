import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { apiCallLog } from '@my-veicolo/db/schema/app'
import { ADMIN_EMAIL, createTestApp, json } from './helpers'

/** Budget 1 €, fake provider 0.5 € per call: two paid lookups fit, the third does not. */
describe('plate lookups (paid API cost control)', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let admin: string, user: string
  beforeAll(async () => {
    t = await createTestApp()
    admin = await t.signUp(ADMIN_EMAIL)
    user = await t.signUp('utente@test.it')
  })
  afterAll(() => t.close())

  const lookup = (plate: string, force = false, cookie = admin) =>
    t.request('/api/admin/plates/lookup', { cookie, body: { plate, force } })
  const calls = async () => t.db.select().from(apiCallLog)

  it('is admin-only', async () => {
    expect((await lookup('AB123CD', false, user)).status).toBe(403)
    expect(await calls()).toHaveLength(0)
  })

  it('first lookup is paid, normalizes the plate and logs the cost', async () => {
    const res = await lookup(' ab-123 cd ')
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body).toMatchObject({ plate: 'AB123CD', source: 'provider', costEur: 0.5, data: { make: 'Toyota', fuel: 'Ibrida benzina' } })
    expect(await calls()).toMatchObject([{ plate: 'AB123CD', costEur: 0.5, ok: true }])
  })

  it('same plate again comes from the cache for free', async () => {
    const body = await json(await lookup('AB123CD'))
    expect(body).toMatchObject({ source: 'cache', costEur: 0 })
    expect(await calls()).toHaveLength(1)
  })

  it('force re-queries the provider (paid)', async () => {
    const body = await json(await lookup('AB123CD', true))
    expect(body).toMatchObject({ source: 'provider', costEur: 0.5 })
    expect(await calls()).toHaveLength(2)
  })

  it('refuses once the monthly budget would be exceeded', async () => {
    const res = await lookup('ZZ999ZZ')
    expect(res.status).toBe(402)
    expect(await json(res)).toMatchObject({ code: 'BUDGET_EXCEEDED' })
    expect(await calls()).toHaveLength(2)
    // cached plates stay free even with the budget exhausted
    expect((await lookup('AB123CD')).status).toBe(200)
  })

  it('a failed call is logged but not charged', async () => {
    const t2 = await createTestApp({}, t.db, { config: { lookupMonthlyBudgetEur: 100 } })
    const res = await t2.request('/api/admin/plates/lookup', { cookie: admin, body: { plate: 'ERR001X' } })
    expect(res.status).toBe(502)
    const failed = (await calls()).find((c) => c.plate === 'ERR001X')
    expect(failed).toMatchObject({ ok: false, costEur: 0 })
  })

  it('without a provider asks for manual entry', async () => {
    const t3 = await createTestApp({}, t.db, { plates: null })
    const res = await t3.request('/api/admin/plates/lookup', { cookie: admin, body: { plate: 'NN000NN' } })
    expect(res.status).toBe(503)
    expect(await json(res)).toMatchObject({ code: 'NO_PROVIDER' })
  })

  it('reports the monthly spend', async () => {
    const body = await json(await t.request('/api/admin/plates/costs', { cookie: admin }))
    expect(body).toMatchObject({ spentEur: 1, budgetEur: 1, provider: { id: 'fake', costEur: 0.5 } })
    expect(body.calls.length).toBeGreaterThanOrEqual(3)
    expect((await t.request('/api/admin/plates/costs', { cookie: user })).status).toBe(403)
  })
})
