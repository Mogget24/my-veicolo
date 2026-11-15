// Local API server for `pnpm dev`.
// Uses a PGlite database in apps/api/.data by default, so dev never touches production data.
// Set DEV_DATABASE=neon to use DATABASE_URL instead.
import { mkdirSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createNeonDb } from '@my-veicolo/db/client'
import { createPgliteDb } from '@my-veicolo/db/pglite'
import { authOptionsFromEnv, createAuth } from './auth'
import { createApp } from './app'
import { requireEnv } from './env'

const useNeon = process.env.DEV_DATABASE === 'neon'
const pgliteDir = '.data/pglite'
if (!useNeon) mkdirSync(pgliteDir, { recursive: true }) // PGlite does not create parent folders
const db = useNeon ? createNeonDb(requireEnv('DATABASE_URL')) : await createPgliteDb(pgliteDir)

process.env.BETTER_AUTH_SECRET ||= 'dev-only-secret-do-not-use-in-production-0123456789'
const auth = createAuth(db, { ...authOptionsFromEnv(), baseURL: 'http://localhost:5173', rateLimit: false })

const port = Number(process.env.API_PORT ?? 8787)
serve({ fetch: createApp(() => ({ db, auth })).fetch, port }, () =>
  console.log(`API su http://localhost:${port}/api (database: ${useNeon ? 'Neon' : 'PGlite locale'})`),
)
