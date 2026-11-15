import { desc, eq, gte, sql } from 'drizzle-orm'
import type { Db } from '@my-veicolo/db/client'
import { apiCallLog, plateLookups } from '@my-veicolo/db/schema/app'
import { vehicleDataSchema, type VehicleData } from '@my-veicolo/shared/vehicle'
import type { PlateProvider } from './provider'

export class LookupError extends Error {
  constructor(
    readonly code: 'NO_PROVIDER' | 'BUDGET_EXCEEDED' | 'LOOKUP_FAILED',
    message: string,
  ) {
    super(message)
  }
}

export type LookupResult = {
  lookupId: string
  plate: string
  data: VehicleData
  fetchedAt: Date
  /** "cache" = free, already looked up before; "provider" = paid call just made. */
  source: 'cache' | 'provider'
  costEur: number
}

/** First instant of the current month (UTC). */
export const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

export async function monthlySpend(db: Db, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${apiCallLog.costEur}), 0)` })
    .from(apiCallLog)
    .where(gte(apiCallLog.createdAt, monthStart(now)))
  return Number(row?.total ?? 0)
}

export async function recentCalls(db: Db, limit = 20) {
  return db.select().from(apiCallLog).orderBy(desc(apiCallLog.createdAt)).limit(limit)
}

/**
 * The only place that may spend money on plate lookups:
 * 1. a cached plate is returned for free (unless `force`);
 * 2. no provider → NO_PROVIDER (enter data by hand);
 * 3. the call must fit in the monthly budget;
 * 4. every attempt is logged; only successful calls are charged.
 */
export async function lookupPlate(
  db: Db,
  provider: PlateProvider | null,
  opts: { plate: string; force?: boolean; adminId: string; monthlyBudgetEur: number },
): Promise<LookupResult> {
  const { plate } = opts

  if (!opts.force) {
    const [cached] = await db.select().from(plateLookups).where(eq(plateLookups.plate, plate))
    if (cached) {
      return {
        lookupId: cached.id,
        plate,
        data: vehicleDataSchema.parse(cached.data),
        fetchedAt: cached.fetchedAt,
        source: 'cache',
        costEur: 0,
      }
    }
  }

  if (!provider) throw new LookupError('NO_PROVIDER', 'Nessun servizio targhe configurato: inserisci i dati a mano')

  const spent = await monthlySpend(db)
  if (spent + provider.costEur > opts.monthlyBudgetEur + 1e-9) {
    throw new LookupError(
      'BUDGET_EXCEEDED',
      `Budget mensile esaurito (${spent.toFixed(2)} € di ${opts.monthlyBudgetEur.toFixed(2)} €). Inserisci i dati a mano o aumenta il budget.`,
    )
  }

  let result: { data: VehicleData; raw: unknown }
  try {
    result = await provider.lookup(plate)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db.insert(apiCallLog).values({ provider: provider.id, plate, costEur: 0, ok: false, error: message, adminId: opts.adminId })
    throw new LookupError('LOOKUP_FAILED', `Ricerca non riuscita: ${message}`)
  }

  const data = vehicleDataSchema.parse(result.data)
  const fetchedAt = new Date()
  const [saved] = await db
    .insert(plateLookups)
    .values({ plate, provider: provider.id, response: result.raw, data, fetchedAt })
    .onConflictDoUpdate({ target: plateLookups.plate, set: { provider: provider.id, response: result.raw, data, fetchedAt } })
    .returning({ id: plateLookups.id })
  await db.insert(apiCallLog).values({ provider: provider.id, plate, costEur: provider.costEur, ok: true, adminId: opts.adminId })

  return { lookupId: saved!.id, plate, data, fetchedAt, source: 'provider', costEur: provider.costEur }
}

/** Whether a plate already has a cached lookup (used to tell the admin a search is free). */
export async function isCached(db: Db, plate: string) {
  const rows = await db.select({ id: plateLookups.id }).from(plateLookups).where(eq(plateLookups.plate, plate)).limit(1)
  return rows.length > 0
}
