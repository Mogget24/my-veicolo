import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

describe('api', () => {
  it('GET /api/health', async () => {
    const t = await createTestApp()
    const res = await t.request('/api/health')
    expect(res.status).toBe(200)
  })

  it('unknown routes return an Italian 404', async () => {
    const t = await createTestApp()
    const res = await t.request('/api/non-esiste')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Risorsa non trovata' })
  })
})
