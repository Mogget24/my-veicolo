// Vercel Function entry: every /api/* request is rewritten here (see vercel.json)
// and handled by the Hono app from the @my-veicolo/api workspace package.
import { handle } from 'hono/vercel'
import { app } from '@my-veicolo/api'

const handler = handle(app)

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const OPTIONS = handler
