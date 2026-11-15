import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateVAPIDKeys } from 'web-push'
import { app } from '../src/app'

describe('api', () => {
  it('GET /api/health', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true })
  })

  it('POST /api/push/test rejects an invalid subscription', async () => {
    const res = await app.request('/api/push/test', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: { endpoint: 'not-a-url' } }),
    })
    expect(res.status).toBe(400)
  })

  describe('POST /api/push/test VAPID config errors', () => {
    const subscription = {
      endpoint: 'https://127.0.0.1:9/fake',
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
        auth: 'tBHItJI5svbpez7KI4CCXg',
      },
    }
    const send = () =>
      app.request('/api/push/test', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
    const generated = generateVAPIDKeys()
    const keys = { VAPID_PUBLIC_KEY: generated.publicKey, VAPID_PRIVATE_KEY: generated.privateKey }

    afterEach(() => vi.unstubAllEnvs())

    it('reports a missing variable by name', async () => {
      vi.stubEnv('VAPID_SUBJECT', 'mailto:a@b.it')
      vi.stubEnv('VAPID_PUBLIC_KEY', keys.VAPID_PUBLIC_KEY)
      vi.stubEnv('VAPID_PRIVATE_KEY', '')
      const res = await send()
      expect(res.status).toBe(500)
      expect(((await res.json()) as { error: string }).error).toContain('VAPID_PRIVATE_KEY')
    })

    it('reports a subject without mailto:', async () => {
      vi.stubEnv('VAPID_SUBJECT', 'a@b.it')
      vi.stubEnv('VAPID_PUBLIC_KEY', keys.VAPID_PUBLIC_KEY)
      vi.stubEnv('VAPID_PRIVATE_KEY', keys.VAPID_PRIVATE_KEY)
      const res = await send()
      expect(res.status).toBe(500)
      expect(((await res.json()) as { error: string }).error).toContain('VAPID_SUBJECT non valido')
    })
  })
})
