import { Hono } from 'hono'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@my-veicolo/db/client'
import { user } from '@my-veicolo/db/schema/auth'
import { vehicleAssignments, vehicles } from '@my-veicolo/db/schema/app'
import { APP_NAME } from '@my-veicolo/shared/brand'
import { formatPlate } from '@my-veicolo/shared/plate'
import { assignmentsSchema, createVehicleSchema, updateVehicleSchema } from '@my-veicolo/shared/vehicle'
import type { AppEnv } from '../../context'
import { createDefaultDeadlines } from '../../deadlines/service'
import { notifyUsers } from '../../push/send'
import { validate } from '../../validate'

const notFound = { error: 'Veicolo non trovato' } as const

const parseId = (value: string) => z.uuid().safeParse(value).data

async function assigneesOf(db: Db, vehicleIds: string[]) {
  if (!vehicleIds.length) return []
  return db
    .select({ vehicleId: vehicleAssignments.vehicleId, id: user.id, name: user.name, email: user.email })
    .from(vehicleAssignments)
    .innerJoin(user, eq(user.id, vehicleAssignments.userId))
    .where(inArray(vehicleAssignments.vehicleId, vehicleIds))
    .orderBy(asc(user.name))
}

/** Only ids of existing users are kept (unknown ids are ignored, not an error). */
async function existingUserIds(db: Db, ids: string[]) {
  if (!ids.length) return []
  const rows = await db.select({ id: user.id }).from(user).where(inArray(user.id, [...new Set(ids)]))
  return rows.map((r) => r.id)
}

async function notifyAssigned(db: Db, vehicle: { id: string; plate: string }, userIds: string[]) {
  await notifyUsers(db, userIds, {
    title: APP_NAME,
    body: `Ti è stato assegnato un veicolo: ${formatPlate(vehicle.plate)}`,
    url: `/veicoli/${vehicle.id}`,
    tag: `assigned-${vehicle.id}`,
  })
}

export const adminVehicleRoutes = new Hono<AppEnv>()
  /** Every vehicle with its assignees. */
  .get('/', async (c) => {
    const { db } = c.var.deps
    const rows = await db.select().from(vehicles).orderBy(asc(vehicles.plate))
    const assignees = await assigneesOf(
      db,
      rows.map((v) => v.id),
    )
    return c.json({
      vehicles: rows.map((v) => ({ ...v, assignees: assignees.filter((a) => a.vehicleId === v.id) })),
    })
  })
  .get('/:id', async (c) => {
    const { db } = c.var.deps
    const id = parseId(c.req.param('id'))
    const [vehicle] = id ? await db.select().from(vehicles).where(eq(vehicles.id, id)) : []
    if (!vehicle) return c.json(notFound, 404)
    return c.json({ vehicle, assignees: await assigneesOf(db, [vehicle.id]) })
  })
  .post('/', validate('json', createVehicleSchema), async (c) => {
    const { db } = c.var.deps
    const { assignTo, ...data } = c.req.valid('json')

    const [existing] = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.plate, data.plate))
    if (existing) return c.json({ error: `Esiste già un veicolo con targa ${formatPlate(data.plate)}`, id: existing.id }, 409)

    const [vehicle] = await db
      .insert(vehicles)
      .values({ ...data, createdBy: c.var.user.id })
      .returning()
    await createDefaultDeadlines(db, vehicle!.id, vehicle!.registrationDate)
    const userIds = await existingUserIds(db, assignTo)
    if (userIds.length) {
      await db.insert(vehicleAssignments).values(userIds.map((userId) => ({ vehicleId: vehicle!.id, userId, assignedBy: c.var.user.id })))
      await notifyAssigned(db, vehicle!, userIds)
    }
    return c.json({ vehicle: vehicle! }, 201)
  })
  .patch('/:id', validate('json', updateVehicleSchema), async (c) => {
    const { db } = c.var.deps
    const id = parseId(c.req.param('id'))
    const [vehicle] = id ? await db.update(vehicles).set(c.req.valid('json')).where(eq(vehicles.id, id)).returning() : []
    if (!vehicle) return c.json(notFound, 404)
    return c.json({ vehicle })
  })
  .delete('/:id', async (c) => {
    const { db } = c.var.deps
    const id = parseId(c.req.param('id'))
    const [deleted] = id ? await db.delete(vehicles).where(eq(vehicles.id, id)).returning({ id: vehicles.id }) : []
    if (!deleted) return c.json(notFound, 404)
    return c.json({ ok: true as const })
  })
  /** Replaces the set of users assigned to the vehicle. Newly assigned users get a push. */
  .put('/:id/assignments', validate('json', assignmentsSchema), async (c) => {
    const { db } = c.var.deps
    const id = parseId(c.req.param('id'))
    const [vehicle] = id ? await db.select({ id: vehicles.id, plate: vehicles.plate }).from(vehicles).where(eq(vehicles.id, id)) : []
    if (!vehicle) return c.json(notFound, 404)

    const wanted = await existingUserIds(db, c.req.valid('json').userIds)
    const current = (await db.select({ userId: vehicleAssignments.userId }).from(vehicleAssignments).where(eq(vehicleAssignments.vehicleId, vehicle.id))).map(
      (r) => r.userId,
    )
    const added = wanted.filter((u) => !current.includes(u))
    const removed = current.filter((u) => !wanted.includes(u))

    if (removed.length) {
      await db.delete(vehicleAssignments).where(and(eq(vehicleAssignments.vehicleId, vehicle.id), inArray(vehicleAssignments.userId, removed)))
    }
    if (added.length) {
      await db.insert(vehicleAssignments).values(added.map((userId) => ({ vehicleId: vehicle.id, userId, assignedBy: c.var.user.id })))
      await notifyAssigned(db, vehicle, added)
    }
    return c.json({ assignees: await assigneesOf(db, [vehicle.id]), added: added.length, removed: removed.length })
  })
