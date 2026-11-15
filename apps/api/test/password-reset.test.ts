import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { passwordResetLinks } from '@my-veicolo/db/schema/app'
import { ADMIN_EMAIL, ORIGIN, createTestApp, json } from './helpers'

describe('admin password reset links', () => {
  let t: Awaited<ReturnType<typeof createTestApp>>
  let admin: string, marioCookie: string, marioId: string
  beforeAll(async () => {
    t = await createTestApp()
    admin = await t.signUp(ADMIN_EMAIL)
    marioCookie = await t.signUp('mario@test.it', 'vecchia-password')
    marioId = (await json(await t.request('/api/me', { cookie: marioCookie }))).user.id
  })
  afterAll(() => t.close())

  const newLink = async () => {
    const res = await t.request(`/api/admin/users/${marioId}/reset-link`, { cookie: admin, body: {} })
    expect(res.status).toBe(200)
    const { url } = await json<{ url: string }>(res)
    expect(url.startsWith(`${ORIGIN}/reimposta-password/`)).toBe(true)
    return url.split('/').pop()!
  }
  const signIn = (password: string) => t.request('/api/auth/sign-in/email', { body: { email: 'mario@test.it', password } })

  it('stores only a hash of the token', async () => {
    const token = await newLink()
    const rows = await t.db.select().from(passwordResetLinks).where(eq(passwordResetLinks.userId, marioId))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.tokenHash).not.toContain(token)
  })

  it('shows who the link is for, and resets the password once', async () => {
    const token = await newLink()
    expect(await json(await t.request(`/api/password-reset/${token}`))).toEqual({ name: 'mario', email: 'mario@test.it' })

    const res = await t.request(`/api/password-reset/${token}`, { body: { password: 'nuova-password-1' } })
    expect(res.status).toBe(200)

    expect((await signIn('vecchia-password')).ok).toBe(false)
    expect((await signIn('nuova-password-1')).ok).toBe(true)
    // existing sessions were revoked, for the API and for the browser's session check
    expect((await t.request('/api/me', { cookie: marioCookie })).status).toBe(401)
    expect(await json(await t.request('/api/auth/get-session', { cookie: marioCookie }))).toBeNull()

    // single use
    expect((await t.request(`/api/password-reset/${token}`, { body: { password: 'altra-password-2' } })).status).toBe(404)
    expect((await t.request(`/api/password-reset/${token}`)).status).toBe(404)
  })

  it('a new link invalidates the previous unused one', async () => {
    const first = await newLink()
    const second = await newLink()
    expect((await t.request(`/api/password-reset/${first}`)).status).toBe(404)
    expect((await t.request(`/api/password-reset/${second}`)).status).toBe(200)
  })

  it('expired links do not work', async () => {
    const token = await newLink()
    await t.db.update(passwordResetLinks).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(passwordResetLinks.userId, marioId))
    expect((await t.request(`/api/password-reset/${token}`, { body: { password: 'scaduta-password' } })).status).toBe(404)
  })

  it('rejects unknown tokens and short passwords', async () => {
    expect((await t.request('/api/password-reset/inventato', { body: { password: 'password-lunga-1' } })).status).toBe(404)
    const token = await newLink()
    expect((await t.request(`/api/password-reset/${token}`, { body: { password: 'corta' } })).status).toBe(400)
  })
})
