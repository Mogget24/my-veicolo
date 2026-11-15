import { and, eq } from 'drizzle-orm'
import { vehicleAssignments, type Db } from '@my-veicolo/db'
import type { SessionUser } from './context'

export const isAdmin = (user: Pick<SessionUser, 'role'>) => user.role === 'admin'

/**
 * The single authorization rule for vehicle-scoped data: admins see everything,
 * users only vehicles assigned to them. Callers answer 404 (not 403) on false,
 * so the existence of other vehicles is not revealed.
 */
export async function canAccessVehicle(db: Db, user: SessionUser, vehicleId: string): Promise<boolean> {
  if (isAdmin(user)) return true
  const rows = await db
    .select({ vehicleId: vehicleAssignments.vehicleId })
    .from(vehicleAssignments)
    .where(and(eq(vehicleAssignments.vehicleId, vehicleId), eq(vehicleAssignments.userId, user.id)))
    .limit(1)
  return rows.length > 0
}
