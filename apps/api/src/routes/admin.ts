import { Hono } from 'hono'
import { asc, count, eq, sql } from 'drizzle-orm'
import { user } from '@my-veicolo/db/schema/auth'
import { pushSubscriptions, vehicleAssignments } from '@my-veicolo/db/schema/app'
import type { AppEnv } from '../context'
import { adminOnly, authed } from '../middleware'

export const adminRoutes = new Hono<AppEnv>()
  .use(authed, adminOnly)
  /** All users with how many vehicles they have and whether any device gets notifications. */
  .get('/users', async (c) => {
    const { db } = c.var.deps
    const vehiclesPerUser = db
      .select({ userId: vehicleAssignments.userId, n: count().as('vehicle_count') })
      .from(vehicleAssignments)
      .groupBy(vehicleAssignments.userId)
      .as('v')
    const devicesPerUser = db
      .select({ userId: pushSubscriptions.userId, n: count().as('device_count') })
      .from(pushSubscriptions)
      .groupBy(pushSubscriptions.userId)
      .as('p')

    const users = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt,
        vehicles: sql<number>`coalesce(${vehiclesPerUser.n}, 0)`.mapWith(Number),
        pushDevices: sql<number>`coalesce(${devicesPerUser.n}, 0)`.mapWith(Number),
      })
      .from(user)
      .leftJoin(vehiclesPerUser, eq(vehiclesPerUser.userId, user.id))
      .leftJoin(devicesPerUser, eq(devicesPerUser.userId, user.id))
      .orderBy(asc(user.createdAt))

    return c.json({ users })
  })
