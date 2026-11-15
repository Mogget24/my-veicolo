/** Reads an env var lazily so missing values fail the request, not the cold start. */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}`)
  return value
}
