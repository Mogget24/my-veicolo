import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import * as authSchema from '@my-veicolo/db/schema/auth'
import type { Db } from '@my-veicolo/db/client'
import { requireEnv } from './env'

export type AuthOptions = {
  /** Public origin of the app, e.g. https://my-veicolo.vercel.app (the API is served under it at /api). */
  baseURL: string
  secret: string
  /** Users signing up with one of these emails become admins. Lowercase. */
  adminEmails: string[]
  signUpEnabled: boolean
  rateLimit: boolean
}

export function createAuth(db: Db, opts: AuthOptions) {
  return betterAuth({
    baseURL: opts.baseURL,
    basePath: '/api/auth',
    secret: opts.secret,
    trustedOrigins: [opts.baseURL],
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !opts.signUpEnabled,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    session: {
      // Long-lived sliding sessions: phone users should rarely have to log in again.
      expiresIn: 60 * 60 * 24 * 60,
      updateAge: 60 * 60 * 24,
      // No cookie cache: every session check hits the DB, so a ban, a password reset or a
      // sign-out on another device takes effect immediately (also for the UI, not only the API).
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: opts.rateLimit,
      storage: 'database',
      modelName: 'rateLimit',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 3 },
      },
    },
    plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] })],
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { ...user, role: opts.adminEmails.includes(user.email.toLowerCase()) ? 'admin' : 'user' },
          }),
        },
      },
    },
    telemetry: { enabled: false },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type SessionData = Auth['$Infer']['Session']

/** Auth options from environment variables (production and `pnpm dev`). */
export function authOptionsFromEnv(): AuthOptions {
  const env = process.env
  const vercelOrigin =
    env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.VERCEL_URL
        ? `https://${env.VERCEL_URL}`
        : undefined

  return {
    baseURL: env.BETTER_AUTH_URL?.trim() || vercelOrigin || 'http://localhost:5173',
    secret: requireEnv('BETTER_AUTH_SECRET'),
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    signUpEnabled: env.SIGNUP_ENABLED?.trim() !== 'false',
    rateLimit: true,
  }
}
