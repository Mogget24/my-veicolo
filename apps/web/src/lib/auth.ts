import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'
import { queryOptions } from '@tanstack/react-query'

/** Better Auth client: same origin, default base path /api/auth. */
export const authClient = createAuthClient({ plugins: [adminClient()] })

export type Session = NonNullable<Awaited<ReturnType<typeof authClient.getSession>>['data']>

/** Current session (null when logged out). Shared by route guards and the header. */
export const sessionQuery = queryOptions({
  queryKey: ['session'],
  queryFn: async () => {
    const { data, error } = await authClient.getSession()
    if (error) throw new Error(error.message ?? 'Impossibile verificare la sessione')
    return data
  },
  staleTime: 5 * 60 * 1000,
})

/** Maps Better Auth errors to Italian messages for the forms. */
export function authErrorMessage(error: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (!error) return 'Si è verificato un errore'
  if (error.status === 429) return 'Troppi tentativi. Riprova tra un minuto.'
  const code = error.code ?? ''
  if (code.includes('INVALID_EMAIL_OR_PASSWORD')) return 'Email o password non corretti'
  if (code.includes('USER_ALREADY_EXISTS')) return 'Esiste già un account con questa email'
  if (code.includes('PASSWORD_TOO_SHORT')) return 'Password troppo corta'
  if (code.includes('PASSWORD_TOO_LONG')) return 'Password troppo lunga'
  if (code.includes('INVALID_EMAIL')) return 'Email non valida'
  if (code.includes('SIGN_UP') && code.includes('DISABLED')) return 'Le registrazioni sono chiuse. Contatta l’amministratore.'
  if (code.includes('BANNED')) return 'Questo account è stato sospeso. Contatta l’amministratore.'
  return 'Si è verificato un errore. Riprova.'
}
