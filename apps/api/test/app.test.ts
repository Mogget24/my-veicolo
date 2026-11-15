import { describe, expect, it } from 'vitest'
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
})
