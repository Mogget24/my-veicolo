import type { Db } from '@my-veicolo/db/client'
import type { Auth, SessionData } from './auth'
import type { PlateProvider } from './plates/provider'

export type AppConfig = {
  /** Public origin of the web app, used to build links (e.g. password reset). */
  appOrigin: string
  /** Max spend on paid plate lookups per calendar month (UTC), in euro. */
  lookupMonthlyBudgetEur: number
}

export type Deps = {
  db: Db
  auth: Auth
  /** null = no paid lookup configured: vehicle data is entered by hand. */
  plates: PlateProvider | null
  config: AppConfig
}

export type SessionUser = SessionData['user']

/** Hono env shared by every route. `user`/`session` are set by the `authed` middleware. */
export type AppEnv = {
  Variables: {
    deps: Deps
    user: SessionUser
    session: SessionData['session']
  }
}
