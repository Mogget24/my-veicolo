/** Reads an env var lazily so missing values fail the request, not the cold start. */
export function requireEnv(name: string): string {
  // Trim: values pasted into dashboards often carry stray spaces or newlines.
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`)
  return value
}
