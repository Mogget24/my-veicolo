import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, createTestApp, createVehicle, json } from './helpers'

/** Cross-user access: every vehicle-scoped route must hide other users' vehicles. */
describe('vehicle access', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let anna: string, bruno: string, admin: string
  let annaCar: { id: string }, sharedCar: { id: string }, unassignedCar: { id: string }

  beforeAll(async () => {
    t = await createTestApp()
    anna = await t.signUp('anna@test.it')
    bruno = await t.signUp('bruno@test.it')
    admin = await t.signUp(ADMIN_EMAIL)
    const id = async (cookie: string) => (await json(await t.request('/api/me', { cookie }))).user.id as string
    const [annaId, brunoId] = [await id(anna), await id(bruno)]

    annaCar = await createVehicle(t.db, 'AA111AA', [annaId])
    sharedCar = await createVehicle(t.db, 'BB222BB', [annaId, brunoId])
    unassignedCar = await createVehicle(t.db, 'CC333CC')
  })
  afterAll(() => t.close())

  const plates = async (cookie: string) =>
    (await json<{ vehicles: { plate: string }[] }>(await t.request('/api/vehicles', { cookie }))).vehicles.map((v) => v.plate)

  it('lists only assigned vehicles', async () => {
    expect(await plates(anna)).toEqual(['AA111AA', 'BB222BB'])
    expect(await plates(bruno)).toEqual(['BB222BB'])
  })

  it('admins see every vehicle', async () => {
    expect(await plates(admin)).toEqual(['AA111AA', 'BB222BB', 'CC333CC'])
  })

  it('returns 404 for a vehicle that is not assigned to the user', async () => {
    expect((await t.request(`/api/vehicles/${annaCar.id}`, { cookie: bruno })).status).toBe(404)
    expect((await t.request(`/api/vehicles/${unassignedCar.id}`, { cookie: anna })).status).toBe(404)
  })

  it('returns the vehicle when assigned (also shared ones)', async () => {
    expect((await t.request(`/api/vehicles/${annaCar.id}`, { cookie: anna })).status).toBe(200)
    expect((await t.request(`/api/vehicles/${sharedCar.id}`, { cookie: bruno })).status).toBe(200)
    expect((await t.request(`/api/vehicles/${unassignedCar.id}`, { cookie: admin })).status).toBe(200)
  })

  it('returns 404 (not 500) for malformed and unknown ids', async () => {
    expect((await t.request('/api/vehicles/non-un-uuid', { cookie: anna })).status).toBe(404)
    expect((await t.request('/api/vehicles/00000000-0000-4000-8000-000000000000', { cookie: admin })).status).toBe(404)
  })

  it('reports assigned vehicles in /me', async () => {
    expect((await json(await t.request('/api/me', { cookie: anna }))).assignedVehicles).toBe(2)
  })

  it('admin routes are admin-only', async () => {
    expect((await t.request('/api/admin/users', { cookie: anna })).status).toBe(403)
    const res = await t.request('/api/admin/users', { cookie: admin })
    expect(res.status).toBe(200)
    const users = (await json(res)).users as { email: string; vehicles: number }[]
    expect(users.find((u) => u.email === 'anna@test.it')?.vehicles).toBe(2)
    expect(users.find((u) => u.email === ADMIN_EMAIL)?.vehicles).toBe(0)
  })
})
