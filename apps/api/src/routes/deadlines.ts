import { Hono } from 'hono'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { deadlineEvents, deadlines, vehicleAssignments, vehicles } from '@my-veicolo/db/schema/app'
import { addDays, formatDateIt, todayInRome } from '@my-veicolo/shared/dates'
import {
  createDeadlineSchema,
  renewDeadlineSchema,
  snoozeDeadlineSchema,
  suggestNextDue,
  updateDeadlineSchema,
} from '@my-veicolo/shared/deadline'
import { canAccessVehicle, isAdmin } from '../access'
import type { AppEnv } from '../context'
import { createDefaultDeadlines, deadlineHistory, findAccessibleDeadline, typed } from '../deadlines/service'
import { authed } from '../middleware'
import { validate } from '../validate'

const notFound = { error: 'Scadenza non trovata' } as const
const vehicleNotFound = { error: 'Veicolo non trovato' } as const
const uuid = (value: string) => z.uuid().safeParse(value).data

/** Every vehicle keeps these: an unknown date is left empty instead. */
const REQUIRED_TYPES: readonly string[] = ['revisione', 'bollo', 'rca']

const byDueDate = [sql`${deadlines.dueDate} asc nulls last`, asc(deadlines.type)]

/** Deadlines of one vehicle, under /api/vehicles/:id/deadlines. */
export const vehicleDeadlineRoutes = new Hono<AppEnv>()
  .use(authed)
  .get('/:id/deadlines', async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    if (!id || !(await canAccessVehicle(db, c.var.user, id))) return c.json(vehicleNotFound, 404)
    const rows = await db.select().from(deadlines).where(eq(deadlines.vehicleId, id)).orderBy(...byDueDate)
    return c.json({ deadlines: rows.map(typed) })
  })
  .post('/:id/deadlines', validate('json', createDeadlineSchema), async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    if (!id || !(await canAccessVehicle(db, c.var.user, id))) return c.json(vehicleNotFound, 404)
    const input = c.req.valid('json')
    const [created] = await db
      .insert(deadlines)
      .values({ ...input, vehicleId: id, estimated: false })
      .onConflictDoNothing()
      .returning()
    if (!created) return c.json({ error: 'Questa scadenza esiste già per il veicolo' }, 409)
    return c.json({ deadline: typed(created) }, 201)
  })
  /** Adds the standard deadlines (revisione, bollo, RCA) the vehicle is missing. */
  .post('/:id/deadlines/defaults', async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    if (!id || !(await canAccessVehicle(db, c.var.user, id))) return c.json(vehicleNotFound, 404)
    const [vehicle] = await db.select({ registrationDate: vehicles.registrationDate }).from(vehicles).where(eq(vehicles.id, id))
    const created = await createDefaultDeadlines(db, id, vehicle?.registrationDate ?? null)
    return c.json({ created: created.length })
  })

/** Deadlines across vehicles, under /api/deadlines. */
export const deadlineRoutes = new Hono<AppEnv>()
  .use(authed)
  /** Every deadline the user can see, soonest first (for the home page and "Ho fatto qualcosa"). */
  .get('/', async (c) => {
    const { db } = c.var.deps
    const user = c.var.user
    const visible = isAdmin(user)
      ? undefined
      : inArray(
          deadlines.vehicleId,
          db.select({ id: vehicleAssignments.vehicleId }).from(vehicleAssignments).where(eq(vehicleAssignments.userId, user.id)),
        )
    const rows = await db
      .select({ deadline: deadlines, vehicle: { id: vehicles.id, plate: vehicles.plate, make: vehicles.make, model: vehicles.model } })
      .from(deadlines)
      .innerJoin(vehicles, eq(vehicles.id, deadlines.vehicleId))
      .where(visible)
      .orderBy(...byDueDate)
    return c.json({ deadlines: rows.map((r) => ({ ...typed(r.deadline), vehicle: r.vehicle })) })
  })
  .get('/:id', async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    const found = id ? await findAccessibleDeadline(db, c.var.user, id) : null
    if (!found) return c.json(notFound, 404)
    return c.json({ ...found, events: await deadlineHistory(db, found.deadline.id) })
  })
  .patch('/:id', validate('json', updateDeadlineSchema), async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    const found = id ? await findAccessibleDeadline(db, c.var.user, id) : null
    if (!found) return c.json(notFound, 404)
    const input = c.req.valid('json')
    // A date set (or confirmed) by the user is no longer an estimate; a different date ends any snooze.
    const dateSet = input.dueDate !== undefined
    const dateChanged = dateSet && input.dueDate !== found.deadline.dueDate
    const [updated] = await db
      .update(deadlines)
      .set({ ...input, ...(dateSet ? { estimated: false } : {}), ...(dateChanged ? { snoozedUntil: null } : {}) })
      .where(eq(deadlines.id, found.deadline.id))
      .returning()
    return c.json({ deadline: typed(updated!) })
  })
  .delete('/:id', async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    const found = id ? await findAccessibleDeadline(db, c.var.user, id) : null
    if (!found) return c.json(notFound, 404)
    if (REQUIRED_TYPES.includes(found.deadline.type)) {
      return c.json({ error: 'Revisione, bollo e assicurazione non si possono eliminare: lascia la data vuota se non serve' }, 409)
    }
    await db.delete(deadlines).where(eq(deadlines.id, found.deadline.id))
    return c.json({ ok: true as const })
  })
  /** "Fatto": records the renewal and moves the deadline to its next due date. */
  .post('/:id/renew', validate('json', renewDeadlineSchema), async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    const found = id ? await findAccessibleDeadline(db, c.var.user, id) : null
    if (!found) return c.json(notFound, 404)
    const { deadline } = found
    const input = c.req.valid('json')
    const newDueDate =
      input.newDueDate !== undefined
        ? input.newDueDate
        : suggestNextDue(deadline.type, { doneDate: input.doneDate, previousDue: deadline.dueDate, recurrenceMonths: deadline.recurrenceMonths })

    const [event] = await db
      .insert(deadlineEvents)
      .values({
        deadlineId: deadline.id,
        kind: 'renewed',
        doneDate: input.doneDate,
        previousDueDate: deadline.dueDate,
        newDueDate,
        costEur: input.costEur ?? null,
        company: input.company ?? null,
        km: input.km ?? null,
        notes: input.notes ?? null,
        doneBy: c.var.user.id,
      })
      .returning()
    const [updated] = await db
      .update(deadlines)
      .set({ dueDate: newDueDate, estimated: false, snoozedUntil: null })
      .where(eq(deadlines.id, deadline.id))
      .returning()
    return c.json({ deadline: typed(updated!), event: event! })
  })
  /** "Ricordamelo più tardi": no reminders until `days` from today; the due date does not change. */
  .post('/:id/snooze', validate('json', snoozeDeadlineSchema), async (c) => {
    const { db } = c.var.deps
    const id = uuid(c.req.param('id'))
    const found = id ? await findAccessibleDeadline(db, c.var.user, id) : null
    if (!found) return c.json(notFound, 404)
    const snoozedUntil = addDays(todayInRome(), c.req.valid('json').days)
    await db.insert(deadlineEvents).values({
      deadlineId: found.deadline.id,
      kind: 'snoozed',
      previousDueDate: found.deadline.dueDate,
      newDueDate: found.deadline.dueDate,
      notes: `Promemoria rimandato al ${formatDateIt(snoozedUntil)}`,
      doneBy: c.var.user.id,
    })
    const [updated] = await db.update(deadlines).set({ snoozedUntil }).where(eq(deadlines.id, found.deadline.id)).returning()
    return c.json({ deadline: typed(updated!) })
  })
