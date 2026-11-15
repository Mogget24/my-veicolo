import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

describe('api', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  beforeAll(async () => {
    t = await createTestApp()
  })
  afterAll(() => t.close())

  it('GET /api/health', async () => {
    expect((await t.request('/api/health')).status).toBe(200)
  })

  it('unknown routes return an Italian 404', async () => {
    const res = await t.request('/api/non-esiste')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Risorsa non trovata' })
  })
})
