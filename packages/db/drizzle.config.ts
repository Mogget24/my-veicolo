import { defineConfig } from 'drizzle-kit'

// Loads the repo-root .env (created by `vercel env pull`) when present.
try {
  process.loadEnvFile('../../.env')
} catch {}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/*.ts',
  out: './migrations',
  // Migrations need a direct (non-pooled) connection.
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
