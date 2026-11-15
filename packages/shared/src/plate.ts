import { z } from 'zod'

/** Uppercase, letters and digits only: " ab-123 cd " → "AB123CD". */
export const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** Current Italian car format (since 1994): two letters, three digits, two letters. */
export const isModernPlate = (plate: string) => /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(plate)

/** "AB123CD" → "AB 123 CD"; other formats are returned as they are. */
export const formatPlate = (plate: string) =>
  isModernPlate(plate) ? `${plate.slice(0, 2)} ${plate.slice(2, 5)} ${plate.slice(5)}` : plate

/** Accepts any spacing/case and outputs the normalized plate. Older and special formats are allowed. */
export const plateSchema = z
  .string()
  .transform(normalizePlate)
  .pipe(z.string().min(5, 'Targa troppo corta').max(10, 'Targa troppo lunga'))
