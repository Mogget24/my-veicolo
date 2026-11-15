import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { generateVAPIDKeys } from 'web-push'
import { pushSubscriptions } from '@my-veicolo/db'
import { createTestApp, json } from './helpers'

const subscription = (endpoint: string) => ({
  endpoint,
  keys: {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  },
})

describe('push', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let anna: string, bruno: string
  beforeAll(async () => {
    t = await createTestApp()
    anna = await t.signUp('anna@test.it')
    bruno = await t.signUp('bruno@test.it')
  })
  afterEach(() => vi.unstubAllEnvs())

  const owners = async () =>
    (await t.db.select().from(pushSubscriptions)).map((s) => `${s.endpoint}`).sort()

  it('requires a session to subscribe', async () => {
    const res = await t.request('/api/push/subscribe', { body: { subscription: subscription('https://push.test/a') } })
    expect(res.status).toBe(401)
  })

  it('saves a subscription per user, and moves a device to its new user', async () => {
    await t.request('/api/push/subscribe', { cookie: anna, body: { subscription: subscription('https://push.test/1') } })
    await t.request('/api/push/subscribe', { cookie: anna, body: { subscription: subscription('https://push.test/1') } })
    expect(await owners()).toEqual(['https://push.test/1'])

    await t.request('/api/push/subscribe', { cookie: bruno, body: { subscription: subscription('https://push.test/1') } })
    const [row] = await t.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, 'https://push.test/1'))
    const brunoId = (await json(await t.request('/api/me', { cookie: bruno }))).user.id
    expect(row?.userId).toBe(brunoId)
  })

  it('cannot unsubscribe a device of another user', async () => {
    await t.request('/api/push/subscribe', { cookie: anna, body: { subscription: subscription('https://push.test/2') } })
    await t.request('/api/push/unsubscribe', { cookie: bruno, body: { endpoint: 'https://push.test/2' } })
    expect(await owners()).toContain('https://push.test/2')
    await t.request('/api/push/unsubscribe', { cookie: anna, body: { endpoint: 'https://push.test/2' } })
    expect(await owners()).not.toContain('https://push.test/2')
  })

  it('test push: 409 without devices, explicit error on bad VAPID config', async () => {
    const keys = generateVAPIDKeys()
    vi.stubEnv('VAPID_SUBJECT', 'mailto:a@b.it')
    vi.stubEnv('VAPID_PUBLIC_KEY', keys.publicKey)
    vi.stubEnv('VAPID_PRIVATE_KEY', keys.privateKey)
    const carla = await t.signUp('carla@test.it')
    expect((await t.request('/api/push/test', { cookie: carla, body: {} })).status).toBe(409)

    vi.stubEnv('VAPID_SUBJECT', 'a@b.it')
    const res = await t.request('/api/push/test', { cookie: carla, body: {} })
    expect(res.status).toBe(500)
    expect((await json(res)).error).toContain('VAPID_SUBJECT non valido')
  })
})
