import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { generateVAPIDKeys } from 'web-push'
import { user } from '@my-veicolo/db/schema/auth'
import { deadlines } from '@my-veicolo/db/schema/app'
import type { PushPayload } from '@my-veicolo/shared/push'
import { runReminders } from '../src/deadlines/reminders'
import { createTestApp, createVehicle, json } from './helpers'

describe('daily reminders', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let annaId: string, brunoId: string
  let deadlineId: string
  const sent: { userId: string; payload: PushPayload }[] = []
  const send = async (userId: string, payload: PushPayload) => void sent.push({ userId, payload })
  const run = async (today: string) => {
    sent.length = 0
    await runReminders(t.db, today, send)
    return sent.map((s) => s.payload.body)
  }

  beforeAll(async () => {
    t = await createTestApp()
    const id = async (cookie: string) => (await json(await t.request('/api/me', { cookie }))).user.id as string
    annaId = await id(await t.signUp('anna@test.it'))
    brunoId = await id(await t.signUp('bruno@test.it'))
    await t.db.update(user).set({ banned: true }).where(eq(user.id, brunoId))
    const car = await createVehicle(t.db, 'AB123CD', [annaId, brunoId])
    const [d] = await t.db.insert(deadlines).values({ vehicleId: car.id, type: 'rca', dueDate: '2026-12-15' }).returning()
    deadlineId = d!.id
  })
  afterAll(() => t.close())
  afterEach(() => vi.unstubAllEnvs())

  it('walks through a whole cycle, once per stage, never to banned users', async () => {
    expect(await run('2026-11-10')).toEqual([]) // 35 days: too early
    expect(await run('2026-11-15')).toEqual(['Scadenza tra 30 giorni (15/12/2026)'])
    expect(sent[0]).toMatchObject({ userId: annaId, payload: { title: 'Assicurazione RCA · AB 123 CD', url: `/scadenze/${deadlineId}`, deadlineId } })
    expect(await run('2026-11-15')).toEqual([]) // same day again: deduplicated
    expect(await run('2026-11-25')).toEqual([]) // still the 30-day stage
    expect(await run('2026-12-10')).toEqual(['Scadenza tra 5 giorni (15/12/2026)']) // 7-day stage (cron missed day 8..6)
    expect(await run('2026-12-14')).toEqual(['Scadenza domani (15/12/2026)'])
    expect(await run('2026-12-15')).toEqual(['Scadenza oggi (15/12/2026)'])
    expect(await run('2026-12-16')).toEqual(['In ritardo di 1 giorno (scadenza 15/12/2026)'])
    expect(await run('2026-12-17')).toEqual([])
    expect(await run('2026-12-19')).toEqual(['In ritardo di 4 giorni (scadenza 15/12/2026)'])
  })

  it('a renewal starts a fresh cycle for the new due date', async () => {
    await t.db.update(deadlines).set({ dueDate: '2027-12-15' }).where(eq(deadlines.id, deadlineId))
    expect(await run('2027-11-15')).toEqual(['Scadenza tra 30 giorni (15/12/2027)'])
  })

  it('snooze: silent until the snooze date, then one reminder, then normal stages', async () => {
    await t.db.update(deadlines).set({ dueDate: '2028-01-20', snoozedUntil: '2028-01-13' }).where(eq(deadlines.id, deadlineId))
    expect(await run('2028-01-11')).toEqual([]) // 9 days left but snoozed
    expect(await run('2028-01-13')).toEqual(['Scadenza tra 7 giorni (20/01/2028)']) // snooze over
    expect(await run('2028-01-14')).toEqual([]) // the 7-day stage was covered by the snooze reminder
    expect(await run('2028-01-19')).toEqual(['Scadenza domani (20/01/2028)'])
  })

  it('deadlines without a date are ignored', async () => {
    await t.db.update(deadlines).set({ dueDate: null, snoozedUntil: null }).where(eq(deadlines.id, deadlineId))
    expect(await run('2028-01-20')).toEqual([])
  })

  it('cron endpoint requires CRON_SECRET', async () => {
    const keys = generateVAPIDKeys()
    vi.stubEnv('CRON_SECRET', 'segreto-di-prova')
    vi.stubEnv('VAPID_SUBJECT', 'mailto:a@b.it')
    vi.stubEnv('VAPID_PUBLIC_KEY', keys.publicKey)
    vi.stubEnv('VAPID_PRIVATE_KEY', keys.privateKey)
    const call = (auth?: string) => t.app.request('/api/cron/reminders', { headers: auth ? { authorization: auth } : {} })
    expect((await call()).status).toBe(401)
    expect((await call('Bearer sbagliato')).status).toBe(401)
    const ok = await call('Bearer segreto-di-prova')
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ checked: expect.any(Number), sent: expect.any(Number) })
  })
})
