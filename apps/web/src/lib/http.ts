/**
 * Turns an API error response ({ error, issues? }) into an Error with an Italian message.
 * Validation issues (400) are listed, so the user sees what to fix.
 */
export async function apiError(res: Response, fallback = 'Si è verificato un errore'): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: unknown; issues?: { message?: string }[] } | null
  const issues = (body?.issues ?? []).map((i) => i.message).filter(Boolean)
  if (issues.length) return new Error(`${body?.error ?? 'Dati non validi'}: ${issues.slice(0, 3).join(', ')}`)
  return new Error(typeof body?.error === 'string' ? body.error : `${fallback} (HTTP ${res.status})`)
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))
