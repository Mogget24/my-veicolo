import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull()

/** Paid plate-lookup cache: one row per plate, kept forever (technical data does not change). */
export const plateLookups = pgTable('plate_lookups', {
  id: uuid('id').primaryKey().defaultRandom(),
  plate: text('plate').notNull().unique(),
  provider: text('provider').notNull(),
  /** Provider response as received, for debugging and re-mapping without paying again. */
  response: jsonb('response').notNull(),
  /** Normalized VehicleData extracted from `response`. */
  data: jsonb('data').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
})

/** Every paid lookup attempt, for the monthly budget guard and the costs page. */
export const apiCallLog = pgTable(
  'api_call_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    plate: text('plate').notNull(),
    costEur: numeric('cost_eur', { precision: 10, scale: 4, mode: 'number' }).notNull(),
    ok: boolean('ok').notNull(),
    error: text('error'),
    adminId: text('admin_id').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('api_call_log_created_at_idx').on(t.createdAt)],
)

export const vehicles = pgTable('vehicles', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Normalized: uppercase, no spaces (e.g. AB123CD). */
  plate: text('plate').notNull().unique(),
  vin: text('vin'),
  make: text('make'),
  model: text('model'),
  version: text('version'),
  fuel: text('fuel'),
  engineCc: integer('engine_cc'),
  powerKw: integer('power_kw'),
  euroClass: text('euro_class'),
  color: text('color'),
  registrationDate: date('registration_date'),
  notes: text('notes'),
  lookupId: uuid('lookup_id').references(() => plateLookups.id, { onDelete: 'set null' }),
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

/** One-time password reset links created by an admin and shared manually (no email). */
export const passwordResetLinks = pgTable(
  'password_reset_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** SHA-256 of the token: the token itself is only in the link. */
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('password_reset_links_user_id_idx').on(t.userId)],
)
