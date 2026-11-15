import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as appTables from './schema/app'
import * as authTables from './schema/auth'

/** Every table, for Drizzle's relational query API. */
export const tables = { ...authTables, ...appTables }

/** Driver-agnostic database type (Neon in production, PGlite in dev/tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof tables>

/** Neon over WebSockets: supports transactions (needed by Better Auth). */
export function createNeonDb(connectionString: string): Db {
  return drizzle({ client: new Pool({ connectionString }), schema: tables }) as unknown as Db
}
