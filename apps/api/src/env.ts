/** Reads an env var lazily so missing values fail the request, not the cold start. */
export function requireEnv(name: string): string {
  // Trim: values pasted into dashboards often carry stray spaces or newlines.
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`)
  return value
}

/** LOOKUP_MONTHLY_BUDGET_EUR, default 5 €. */
export function lookupBudgetFromEnv(): number {
  const raw = process.env.LOOKUP_MONTHLY_BUDGET_EUR?.trim()
  const value = raw ? Number(raw) : 5
  if (!Number.isFinite(value) || value < 0) throw new Error(`LOOKUP_MONTHLY_BUDGET_EUR non valido: ${raw}`)
  return value
}
