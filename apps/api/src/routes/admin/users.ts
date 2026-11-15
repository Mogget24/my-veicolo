import { Hono } from 'hono'
import { and, asc, count, eq, isNull, sql } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'
import { user } from '@my-veicolo/db/schema/auth'
import { passwordResetLinks, pushSubscriptions, vehicleAssignments, vehicles } from '@my-veicolo/db/schema/app'
import type { AppEnv } from '../../context'

export const RESET_LINK_TTL_MS = 24 * 60 * 60 * 1000

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')


/**
 * User management. Ban/unban and role changes go through the Better Auth admin
 * endpoints (/api/auth/admin/*) called directly by the web client.
 */
export const adminUserRoutes = new Hono<AppEnv>()
  /** All users with how many vehicles they have and whether any device gets notifications. */
  .get('/', async (c) => {
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
  /** One user with assigned vehicles. */
  .get('/:id', async (c) => {
    const { db } = c.var.deps
    const id = c.req.param('id')
    const [u] = await db
      .select({ id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, id))
    if (!u) return c.json({ error: 'Utente non trovato' }, 404)

    const assigned = await db
      .select({ id: vehicles.id, plate: vehicles.plate, make: vehicles.make, model: vehicles.model })
      .from(vehicleAssignments)
      .innerJoin(vehicles, eq(vehicles.id, vehicleAssignments.vehicleId))
      .where(eq(vehicleAssignments.userId, id))
      .orderBy(asc(vehicles.plate))
    const [devices] = await db.select({ n: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, id))

    return c.json({ user: { ...u, pushDevices: devices?.n ?? 0 }, vehicles: assigned })
  })
  /**
   * Creates a one-time password reset link (24h) to send to the user by hand.
   * Previous unused links of the same user stop working.
   */
  .post('/:id/reset-link', async (c) => {
    const { db, config } = c.var.deps
    const id = c.req.param('id')
    const [u] = await db.select({ id: user.id }).from(user).where(eq(user.id, id))
    if (!u) return c.json({ error: 'Utente non trovato' }, 404)

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + RESET_LINK_TTL_MS)
    await db.delete(passwordResetLinks).where(and(eq(passwordResetLinks.userId, id), isNull(passwordResetLinks.usedAt)))
    await db.insert(passwordResetLinks).values({ userId: id, tokenHash: hashToken(token), expiresAt, createdBy: c.var.user.id })

    return c.json({ url: `${config.appOrigin}/reimposta-password/${token}`, expiresAt })
  })
