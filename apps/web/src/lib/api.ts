import { hc } from 'hono/client'
import type { AppType } from '@my-veicolo/api'

/** Typed client for the Hono API (same origin, cookies included). */
export const api = hc<AppType>('/', { init: { credentials: 'include' } }).api
