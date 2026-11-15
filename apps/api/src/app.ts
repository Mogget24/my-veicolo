import { Hono } from 'hono'
import { pushRoutes } from './routes/push'

export const app = new Hono()
  .basePath('/api')
  .get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }))
  .route('/push', pushRoutes)

app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Errore interno del server' }, 500)
})

export type AppType = typeof app
