import { desc, eq } from 'drizzle-orm'
import type { Db } from '@my-veicolo/db/client'
import { deadlineEvents, deadlines, vehicles } from '@my-veicolo/db/schema/app'
import { todayInRome, type IsoDate } from '@my-veicolo/shared/dates'
import { defaultDeadlines, type DeadlineType } from '@my-veicolo/shared/deadline'
import { canAccessVehicle } from '../access'
import type { SessionUser } from '../context'

export type DeadlineRow = typeof deadlines.$inferSelect

/** The DB stores `type` as text; the API exposes the typed union. */
export const typed = <T extends { type: string }>(row: T) => row as T & { type: DeadlineType }

/**
 * Creates the standard deadlines a vehicle is missing (revisione, bollo, RCA),
 * with dates estimated from the registration date. Existing ones are left alone.
 */
export async function createDefaultDeadlines(db: Db, vehicleId: string, registrationDate: IsoDate | null) {
  const existing = new Set(
    (await db.select({ type: deadlines.type }).from(deadlines).where(eq(deadlines.vehicleId, vehicleId))).map((d) => d.type),
  )
  const missing = defaultDeadlines(registrationDate, todayInRome()).filter((d) => !existing.has(d.type))
  if (!missing.length) return []
  return db
    .insert(deadlines)
    .values(missing.map((d) => ({ vehicleId, type: d.type, dueDate: d.dueDate, estimated: d.dueDate !== null })))
    .onConflictDoNothing()
    .returning()
}

/** A deadline with its vehicle, only if the user may access that vehicle. */
export async function findAccessibleDeadline(db: Db, user: SessionUser, id: string) {
  const [row] = await db
    .select({ deadline: deadlines, vehicle: { id: vehicles.id, plate: vehicles.plate, make: vehicles.make, model: vehicles.model } })
    .from(deadlines)
    .innerJoin(vehicles, eq(vehicles.id, deadlines.vehicleId))
    .where(eq(deadlines.id, id))
  if (!row || !(await canAccessVehicle(db, user, row.vehicle.id))) return null
  return { deadline: typed(row.deadline), vehicle: row.vehicle }
}

export async function deadlineHistory(db: Db, deadlineId: string) {
  return db.select().from(deadlineEvents).where(eq(deadlineEvents.deadlineId, deadlineId)).orderBy(desc(deadlineEvents.createdAt))
}
