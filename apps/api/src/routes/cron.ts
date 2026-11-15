import { Hono } from 'hono'
import { todayInRome } from '@my-veicolo/shared/dates'
import type { AppEnv } from '../context'
import { runReminders } from '../deadlines/reminders'
import { configureWebPush, sendToUser } from '../push/send'
import { requireEnv } from '../env'

/**
 * Vercel Cron (see apps/web/vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`
 * when the CRON_SECRET env var is set; anything else is rejected.
 */
export const cronRoutes = new Hono<AppEnv>().get('/reminders', async (c) => {
  if (c.req.header('authorization') !== `Bearer ${requireEnv('CRON_SECRET')}`) {
    return c.json({ error: 'Non autorizzato' }, 401)
  }
  const configError = configureWebPush()
  if (configError) return c.json({ error: configError }, 500)

  const { db } = c.var.deps
  const today = todayInRome()
  const result = await runReminders(db, today, (userId, payload) => sendToUser(db, userId, payload))
  console.log('reminders', today, result)
  return c.json({ today, ...result })
})
