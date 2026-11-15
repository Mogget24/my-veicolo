import { Hono } from 'hono'
import { count, eq } from 'drizzle-orm'
import { vehicleAssignments } from '@my-veicolo/db/schema/app'
import type { AppEnv } from '../context'
import { authed } from '../middleware'

export const meRoutes = new Hono<AppEnv>().use(authed).get('/', async (c) => {
  const { db } = c.var.deps
  const { id, name, email, role } = c.var.user
  const [row] = await db
    .select({ n: count() })
    .from(vehicleAssignments)
    .where(eq(vehicleAssignments.userId, id))
  return c.json({ user: { id, name, email, role }, assignedVehicles: row?.n ?? 0 })
})
