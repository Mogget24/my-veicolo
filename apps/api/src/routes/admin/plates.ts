import { Hono } from 'hono'
import { z } from 'zod'
import { plateSchema } from '@my-veicolo/shared/plate'
import type { AppEnv } from '../../context'
import { LookupError, lookupPlate, monthStart, monthlySpend, recentCalls } from '../../plates/lookup'
import { validate } from '../../validate'

const statusFor = { NO_PROVIDER: 503, BUDGET_EXCEEDED: 402, LOOKUP_FAILED: 502 } as const

export const adminPlateRoutes = new Hono<AppEnv>()
  /** Looks up technical data for a plate: free from the cache, otherwise a paid call (see lookupPlate). */
  .post('/lookup', validate('json', z.object({ plate: plateSchema, force: z.boolean().default(false) })), async (c) => {
    const { db, plates, config } = c.var.deps
    const { plate, force } = c.req.valid('json')
    try {
      const result = await lookupPlate(db, plates, {
        plate,
        force,
        adminId: c.var.user.id,
        monthlyBudgetEur: config.lookupMonthlyBudgetEur,
      })
      return c.json(result)
    } catch (err) {
      if (err instanceof LookupError) return c.json({ error: err.message, code: err.code }, statusFor[err.code])
      throw err
    }
  })
  /** Spend this month vs budget, provider info and the latest calls. */
  .get('/costs', async (c) => {
    const { db, plates, config } = c.var.deps
    const now = new Date()
    return c.json({
      month: monthStart(now).toISOString().slice(0, 7),
      spentEur: await monthlySpend(db, now),
      budgetEur: config.lookupMonthlyBudgetEur,
      provider: plates ? { id: plates.id, costEur: plates.costEur } : null,
      calls: await recentCalls(db),
    })
  })
