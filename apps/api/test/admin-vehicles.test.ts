import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, createTestApp, json } from './helpers'

describe('admin: vehicles and assignments', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let admin: string, anna: string, bruno: string
  let annaId: string, brunoId: string
  beforeAll(async () => {
    t = await createTestApp()
    admin = await t.signUp(ADMIN_EMAIL)
    anna = await t.signUp('anna@test.it')
    bruno = await t.signUp('bruno@test.it')
    annaId = (await json(await t.request('/api/me', { cookie: anna }))).user.id
    brunoId = (await json(await t.request('/api/me', { cookie: bruno }))).user.id
  })
  afterAll(() => t.close())

  const visibleTo = async (cookie: string) =>
    (await json<{ vehicles: { plate: string }[] }>(await t.request('/api/vehicles', { cookie }))).vehicles.map((v) => v.plate)

  let carId: string

  it('creates a vehicle with a normalized plate and assigns it', async () => {
    const res = await t.request('/api/admin/vehicles', {
      cookie: admin,
      body: { plate: 'ab 123 cd', make: 'Fiat', model: ' Panda ', fuel: '', engineCc: 999, assignTo: [annaId, 'utente-inesistente'] },
    })
    expect(res.status).toBe(201)
    const { vehicle } = await json(res)
    carId = vehicle.id
    expect(vehicle).toMatchObject({ plate: 'AB123CD', model: 'Panda', fuel: null, engineCc: 999 })
    expect(await visibleTo(anna)).toEqual(['AB123CD'])
    expect(await visibleTo(bruno)).toEqual([])
  })

  it('rejects a duplicate plate', async () => {
    const res = await t.request('/api/admin/vehicles', { cookie: admin, body: { plate: 'AB-123-CD' } })
    expect(res.status).toBe(409)
    expect((await json(res)).id).toBe(carId)
  })

  it('validates input with Italian messages', async () => {
    const res = await t.request('/api/admin/vehicles', { cookie: admin, body: { plate: 'AB1', engineCc: 3.5 } })
    expect(res.status).toBe(400)
    const messages = (await json(res)).issues.map((i: { message: string }) => i.message)
    expect(messages).toEqual(expect.arrayContaining(['Targa troppo corta', 'Cilindrata: numero intero']))
  })

  it('updates vehicle data', async () => {
    const res = await t.request(`/api/admin/vehicles/${carId}`, { method: 'PATCH', cookie: admin, body: { color: 'Grigio', notes: '' } })
    expect(await json(res)).toMatchObject({ vehicle: { color: 'Grigio', notes: null, make: 'Fiat' } })
  })

  it('replaces assignments: access follows immediately', async () => {
    const res = await t.request(`/api/admin/vehicles/${carId}/assignments`, { method: 'PUT', cookie: admin, body: { userIds: [brunoId] } })
    expect(await json(res)).toMatchObject({ added: 1, removed: 1, assignees: [{ id: brunoId }] })
    expect(await visibleTo(anna)).toEqual([])
    expect(await visibleTo(bruno)).toEqual(['AB123CD'])
    expect((await t.request(`/api/vehicles/${carId}`, { cookie: anna })).status).toBe(404)
  })

  it('lists vehicles with assignees and shows a user with their vehicles', async () => {
    const list = await json(await t.request('/api/admin/vehicles', { cookie: admin }))
    expect(list.vehicles).toMatchObject([{ plate: 'AB123CD', assignees: [{ email: 'bruno@test.it' }] }])
    const detail = await json(await t.request(`/api/admin/users/${brunoId}`, { cookie: admin }))
    expect(detail).toMatchObject({ user: { email: 'bruno@test.it', pushDevices: 0 }, vehicles: [{ plate: 'AB123CD' }] })
  })

  it('every admin route is forbidden to normal users', async () => {
    const attempts = [
      t.request('/api/admin/vehicles', { cookie: anna }),
      t.request(`/api/admin/vehicles/${carId}`, { cookie: anna }),
      t.request('/api/admin/vehicles', { cookie: anna, body: { plate: 'XX000XX' } }),
      t.request(`/api/admin/vehicles/${carId}`, { method: 'PATCH', cookie: anna, body: { color: 'Rosso' } }),
      t.request(`/api/admin/vehicles/${carId}/assignments`, { method: 'PUT', cookie: anna, body: { userIds: [annaId] } }),
      t.request(`/api/admin/vehicles/${carId}`, { method: 'DELETE', cookie: anna }),
      t.request(`/api/admin/users/${annaId}`, { cookie: anna }),
      t.request(`/api/admin/users/${annaId}/reset-link`, { cookie: anna, body: {} }),
    ]
    expect((await Promise.all(attempts)).map((r) => r.status)).toEqual(Array(attempts.length).fill(403))
  })

  it('deletes a vehicle and its assignments', async () => {
    expect((await t.request(`/api/admin/vehicles/${carId}`, { method: 'DELETE', cookie: admin })).status).toBe(200)
    expect(await visibleTo(bruno)).toEqual([])
    expect((await t.request(`/api/admin/vehicles/${carId}`, { cookie: admin })).status).toBe(404)
  })
})
