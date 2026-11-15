import { Hono } from 'hono'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { vehicleAssignments, vehicles } from '@my-veicolo/db/schema/app'
import type { AppEnv } from '../context'
import { authed } from '../middleware'
import { canAccessVehicle, isAdmin } from '../access'

const vehicleColumns = {
  id: vehicles.id,
  plate: vehicles.plate,
  make: vehicles.make,
  model: vehicles.model,
  version: vehicles.version,
  fuel: vehicles.fuel,
  registrationDate: vehicles.registrationDate,
  notes: vehicles.notes,
}

const notFound = { error: 'Veicolo non trovato' } as const

export const vehicleRoutes = new Hono<AppEnv>()
  .use(authed)
  /** Vehicles assigned to the current user (all vehicles for admins). */
  .get('/', async (c) => {
    const { db } = c.var.deps
    const user = c.var.user
    const rows = isAdmin(user)
      ? await db.select(vehicleColumns).from(vehicles).orderBy(asc(vehicles.plate))
      : await db
          .select(vehicleColumns)
          .from(vehicles)
          .innerJoin(vehicleAssignments, eq(vehicleAssignments.vehicleId, vehicles.id))
          .where(eq(vehicleAssignments.userId, user.id))
          .orderBy(asc(vehicles.plate))
    return c.json({ vehicles: rows })
  })
  .get('/:id', async (c) => {
    const { db } = c.var.deps
    const id = z.uuid().safeParse(c.req.param('id'))
    if (!id.success || !(await canAccessVehicle(db, c.var.user, id.data))) return c.json(notFound, 404)

    const [vehicle] = await db.select(vehicleColumns).from(vehicles).where(eq(vehicles.id, id.data))
    if (!vehicle) return c.json(notFound, 404)
    return c.json({ vehicle })
  })
