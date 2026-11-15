import type { Db } from '@my-veicolo/db'
import type { Auth, SessionData } from './auth'

export type Deps = { db: Db; auth: Auth }

export type SessionUser = SessionData['user']

/** Hono env shared by every route. `user`/`session` are set by the `authed` middleware. */
export type AppEnv = {
  Variables: {
    deps: Deps
    user: SessionUser
    session: SessionData['session']
  }
}
