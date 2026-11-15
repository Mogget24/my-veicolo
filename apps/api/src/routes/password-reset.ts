import { Hono } from 'hono'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { user } from '@my-veicolo/db/schema/auth'
import { passwordResetLinks } from '@my-veicolo/db/schema/app'
import { PASSWORD_MIN_LENGTH } from '@my-veicolo/shared/auth'
import type { AppEnv } from '../context'
import { validate } from '../validate'
import { hashToken } from './admin/users'

const invalid = { error: 'Link non valido o scaduto. Chiedi all’amministratore un nuovo link.' } as const

/** Public: the token in the link is the credential (256 bit, stored only as a hash, one use, 24h). */
export const passwordResetRoutes = new Hono<AppEnv>()
  /** Lets the page show who the link is for before asking for a new password. */
  .get('/:token', async (c) => {
    const { db } = c.var.deps
    const [link] = await db
      .select({ name: user.name, email: user.email })
      .from(passwordResetLinks)
      .innerJoin(user, eq(user.id, passwordResetLinks.userId))
      .where(
        and(
          eq(passwordResetLinks.tokenHash, hashToken(c.req.param('token'))),
          isNull(passwordResetLinks.usedAt),
          gt(passwordResetLinks.expiresAt, new Date()),
        ),
      )
    if (!link) return c.json(invalid, 404)
    return c.json(link)
  })
  .post(
    '/:token',
    validate('json', z.object({ password: z.string().min(PASSWORD_MIN_LENGTH).max(128) })),
    async (c) => {
      const { db, auth } = c.var.deps
      // Claim the link atomically: a second request with the same token finds nothing.
      const [link] = await db
        .update(passwordResetLinks)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResetLinks.tokenHash, hashToken(c.req.param('token'))),
            isNull(passwordResetLinks.usedAt),
            gt(passwordResetLinks.expiresAt, new Date()),
          ),
        )
        .returning({ userId: passwordResetLinks.userId })
      if (!link) return c.json(invalid, 404)

      const ctx = await auth.$context
      await ctx.internalAdapter.updatePassword(link.userId, await ctx.password.hash(c.req.valid('json').password))
      // Sign out every device: whoever had the old password loses access.
      await ctx.internalAdapter.deleteUserSessions(link.userId)
      return c.json({ ok: true as const })
    },
  )
