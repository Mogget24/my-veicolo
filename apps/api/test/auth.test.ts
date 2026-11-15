import { beforeAll, describe, expect, it } from 'vitest'
import { ADMIN_EMAIL, createTestApp, json, sessionCookie } from './helpers'

describe('auth', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  beforeAll(async () => {
    t = await createTestApp()
  })

  it('a new user gets role "user" and no vehicles', async () => {
    const cookie = await t.signUp('mario@test.it')
    const res = await t.request('/api/me', { cookie })
    expect(res.status).toBe(200)
    expect(await json(res)).toMatchObject({ user: { email: 'mario@test.it', role: 'user' }, assignedVehicles: 0 })
  })

  it('an email in ADMIN_EMAILS becomes admin (case-insensitive)', async () => {
    const cookie = await t.signUp(ADMIN_EMAIL.toUpperCase())
    const body = await json(await t.request('/api/me', { cookie }))
    expect(body.user.role).toBe('admin')
  })

  it('signs in with email and password', async () => {
    await t.signUp('luca@test.it', 'una-password-lunga')
    const bad = await t.request('/api/auth/sign-in/email', { body: { email: 'luca@test.it', password: 'sbagliata-123' } })
    expect(bad.status).toBe(401)
    const ok = await t.request('/api/auth/sign-in/email', { body: { email: 'luca@test.it', password: 'una-password-lunga' } })
    expect(ok.status).toBe(200)
    const me = await t.request('/api/me', { cookie: sessionCookie(ok) })
    expect(me.status).toBe(200)
  })

  it('rejects requests without a session', async () => {
    for (const path of ['/api/me', '/api/vehicles', '/api/admin/users']) {
      expect((await t.request(path)).status, path).toBe(401)
    }
  })

  it('rejects sign-up when SIGNUP_ENABLED=false', async () => {
    const closed = await createTestApp({ signUpEnabled: false })
    const res = await closed.request('/api/auth/sign-up/email', {
      body: { email: 'nuovo@test.it', password: 'password-sicura-1', name: 'nuovo' },
    })
    expect(res.ok).toBe(false)
  })

  it('a banned user loses access and cannot sign in again', async () => {
    const b = await createTestApp()
    const admin = await b.signUp(ADMIN_EMAIL)
    const cookie = await b.signUp('cattivo@test.it')
    const me = await json(await b.request('/api/me', { cookie }))

    const ban = await b.request('/api/auth/admin/ban-user', { cookie: admin, body: { userId: me.user.id } })
    expect(ban.status).toBe(200)

    expect((await b.request('/api/me', { cookie })).status).toBe(401)
    const relogin = await b.request('/api/auth/sign-in/email', {
      body: { email: 'cattivo@test.it', password: 'password-sicura-1' },
    })
    expect(relogin.ok).toBe(false)
  })

  it('a non-admin cannot use the admin plugin endpoints', async () => {
    const cookie = await t.signUp('furbo@test.it')
    const me = await json(await t.request('/api/me', { cookie }))
    const res = await t.request('/api/auth/admin/set-role', { cookie, body: { userId: me.user.id, role: 'admin' } })
    expect(res.ok).toBe(false)
  })
})
