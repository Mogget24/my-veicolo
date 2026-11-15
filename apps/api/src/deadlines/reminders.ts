import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'
import type { Db } from '@my-veicolo/db/client'
import { user } from '@my-veicolo/db/schema/auth'
import { deadlines, notificationLog, vehicleAssignments, vehicles } from '@my-veicolo/db/schema/app'
import { daysBetween, type IsoDate } from '@my-veicolo/shared/dates'
import { deadlineLabel, reminderBody, reminderStage, type DeadlineType } from '@my-veicolo/shared/deadline'
import { formatPlate } from '@my-veicolo/shared/plate'
import type { PushPayload } from '@my-veicolo/shared/push'

export type Sender = (userId: string, payload: PushPayload) => Promise<unknown>

/**
 * Daily reminder run. For every dated deadline and every (non-banned) user assigned to its
 * vehicle, works out the reminder stage for `today` and sends it once:
 * - stages come from reminderStage (30/7/1/0 days before, every 3 days overdue);
 * - the log key includes the due date, so a renewal starts a fresh cycle;
 * - while snoozed nothing is sent; on/after the snooze date one extra reminder, then normal stages;
 * - the log row is written before sending, so concurrent or repeated runs never double-send.
 */
export async function runReminders(db: Db, today: IsoDate, send: Sender) {
  const rows = await db
    .select({
      id: deadlines.id,
      type: deadlines.type,
      label: deadlines.label,
      dueDate: deadlines.dueDate,
      snoozedUntil: deadlines.snoozedUntil,
      plate: vehicles.plate,
      userId: vehicleAssignments.userId,
    })
    .from(deadlines)
    .innerJoin(vehicles, eq(vehicles.id, deadlines.vehicleId))
    .innerJoin(vehicleAssignments, eq(vehicleAssignments.vehicleId, vehicles.id))
    .innerJoin(user, eq(user.id, vehicleAssignments.userId))
    .where(and(isNotNull(deadlines.dueDate), or(eq(user.banned, false), isNull(user.banned))))

  let sent = 0
  for (const row of rows) {
    if (!row.dueDate) continue
    if (row.snoozedUntil && row.snoozedUntil > today) continue

    const days = daysBetween(today, row.dueDate)
    // At most one reminder per deadline, user and run: the end-of-snooze one first, if due.
    const candidates: string[] = []
    if (row.snoozedUntil && days <= 30) candidates.push(`s${row.snoozedUntil}`)
    const stage = reminderStage(days)
    if (stage) candidates.push(stage)

    let claimed = false
    for (const candidate of candidates) {
      const inserted = await db
        .insert(notificationLog)
        .values({ deadlineId: row.id, userId: row.userId, stage: `${row.dueDate}:${candidate}` })
        .onConflictDoNothing()
        .returning({ stage: notificationLog.stage })
      if (inserted.length) {
        claimed = true
        break
      }
    }
    if (!claimed) continue
    // The end-of-snooze reminder also covers the current stage (no second reminder tomorrow).
    if (stage && row.snoozedUntil) {
      await db
        .insert(notificationLog)
        .values({ deadlineId: row.id, userId: row.userId, stage: `${row.dueDate}:${stage}` })
        .onConflictDoNothing()
    }

    await send(row.userId, {
      title: `${deadlineLabel({ type: row.type as DeadlineType, label: row.label })} · ${formatPlate(row.plate)}`,
      body: reminderBody(days, row.dueDate),
      url: `/scadenze/${row.id}`,
      tag: `deadline-${row.id}`,
      deadlineId: row.id,
    })
    sent++
  }
  return { checked: rows.length, sent }
}
