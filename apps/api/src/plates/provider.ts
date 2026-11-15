import type { VehicleData } from '@my-veicolo/shared/vehicle'

/**
 * A paid plate-lookup service. Implementations map the provider response to VehicleData
 * and keep the raw response so it can be re-mapped later without paying again.
 */
export type PlateProvider = {
  id: string
  /** Price of one successful lookup, in euro (used by the budget guard and the cost log). */
  costEur: number
  lookup(plate: string): Promise<{ data: VehicleData; raw: unknown }>
}

/**
 * Free fake provider for dev and tests: deterministic data derived from the plate.
 * Plates starting with "ERR" fail, to exercise the error path.
 */
export function createFakeProvider(costEur = 0.5): PlateProvider {
  return {
    id: 'fake',
    costEur,
    async lookup(plate) {
      if (plate.startsWith('ERR')) throw new Error('Targa non trovata (fake)')
      const models = [
        ['Fiat', 'Panda', '1.0 FireFly Hybrid'],
        ['Volkswagen', 'Golf', '2.0 TDI'],
        ['Toyota', 'Yaris', '1.5 Hybrid'],
      ] as const
      const [make, model, version] = models[plate.charCodeAt(0) % models.length]!
      const data: VehicleData = {
        make,
        model,
        version,
        fuel: version.includes('TDI') ? 'Diesel' : 'Ibrida benzina',
        engineCc: version.includes('2.0') ? 1968 : 999,
        powerKw: version.includes('2.0') ? 110 : 51,
        euroClass: 'Euro 6d',
        registrationDate: '2021-03-15',
        vin: null,
        color: null,
      }
      return { data, raw: { fake: true, plate, ...data } }
    },
  }
}

/**
 * Provider selected by PLATE_PROVIDER. Returns null when none is configured:
 * the admin then enters vehicle data by hand.
 */
export function plateProviderFromEnv(): PlateProvider | null {
  const id = process.env.PLATE_PROVIDER?.trim()
  if (!id || id === 'none') return null
  if (id === 'fake') return createFakeProvider()
  throw new Error(`PLATE_PROVIDER sconosciuto: ${id}`)
}
