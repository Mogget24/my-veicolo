import { date, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { user } from './auth'

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Normalized: uppercase, no spaces (e.g. AB123CD). */
  plate: text('plate').notNull().unique(),
  make: text('make'),
  model: text('model'),
  version: text('version'),
  fuel: text('fuel'),
  registrationDate: date('registration_date'),
  notes: text('notes'),
  createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
})

export const vehicleAssignments = pgTable(
  'vehicle_assignments',
  {
    vehicleId: uuid('vehicle_id')
      .notNull()
      .references(() => vehicles.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    assignedBy: text('assigned_by').references(() => user.id, { onDelete: 'set null' }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.vehicleId, t.userId] }), index('vehicle_assignments_user_id_idx').on(t.userId)],
)

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
  },
  (t) => [index('push_subscriptions_user_id_idx').on(t.userId)],
)
