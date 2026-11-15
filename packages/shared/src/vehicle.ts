import { z } from 'zod'
import { plateSchema } from './plate'

export const FUELS = ['Benzina', 'Diesel', 'GPL', 'Metano', 'Ibrida benzina', 'Ibrida diesel', 'Elettrica'] as const

/** Optional free text: trimmed, empty string becomes null. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Massimo ${max} caratteri`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

const int = (min: number, max: number, label: string) =>
  z.number().int(`${label}: numero intero`).min(min, `${label}: minimo ${min}`).max(max, `${label}: massimo ${max}`).nullable().optional()

/** Technical data of a vehicle. Also the normalized output of a plate lookup provider. */
export const vehicleDataSchema = z.object({
  vin: text(17),
  make: text(60),
  model: text(80),
  version: text(120),
  fuel: text(40),
  engineCc: int(50, 10_000, 'Cilindrata'),
  powerKw: int(1, 2_000, 'Potenza'),
  euroClass: text(20),
  color: text(40),
  registrationDate: z.iso.date('Data non valida').nullable().optional(),
  notes: text(2_000),
})
export type VehicleData = z.infer<typeof vehicleDataSchema>

export const createVehicleSchema = vehicleDataSchema.extend({
  plate: plateSchema,
  /** Cached lookup the data came from, if any. */
  lookupId: z.uuid().nullable().optional(),
  assignTo: z.array(z.string().min(1)).max(50).default([]),
})

export const updateVehicleSchema = vehicleDataSchema.partial()

export const assignmentsSchema = z.object({ userIds: z.array(z.string().min(1)).max(50) })
