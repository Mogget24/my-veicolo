// Dev/test only: in-process Postgres. Not imported by the production app.
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { fileURLToPath } from 'node:url'
import { tables, type Db } from './client'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

export type PgliteDb = Db & { $client: PGlite }

/**
 * Creates a PGlite database (in memory, or persisted in `dataDir`) and applies all migrations.
 * Each instance reserves a lot of WASM memory: reuse it where possible and `$client.close()` it when done.
 */
export async function createPgliteDb(dataDir?: string): Promise<PgliteDb> {
  const db = drizzle({ client: new PGlite(dataDir), schema: tables })
  await migrate(db, { migrationsFolder })
  return db as unknown as PgliteDb
}
