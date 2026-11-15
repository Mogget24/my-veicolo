// Dev/test only: in-process Postgres. Not imported by the production app.
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'
import type { Db } from './client'

const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

/** Creates a PGlite database (in memory, or persisted in `dataDir`) and applies all migrations. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const db = drizzle({ client: new PGlite(dataDir), schema })
  await migrate(db, { migrationsFolder })
  return db as unknown as Db
}
