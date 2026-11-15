import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

/** Driver-agnostic database type (Neon in production, PGlite in dev/tests). */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/** Neon over WebSockets: supports transactions (needed by Better Auth). */
export function createNeonDb(connectionString: string): Db {
  return drizzle({ client: new Pool({ connectionString }), schema }) as unknown as Db
}
