import { useState, type ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { normalizePlate } from '@my-veicolo/shared/plate'
import { FUELS, type VehicleData } from '@my-veicolo/shared/vehicle'
import { FormError } from './AuthCard'
import { Button } from './Button'
import { TextField } from './TextField'
import { errorText } from '../lib/http'

/** What the form produces: VehicleData (+ normalized plate when the plate is editable). */
export type VehicleFormPayload = VehicleData & { plate: string }

const intText = (label: string) =>
  z.string().trim().refine((v) => v === '' || /^\d+$/.test(v), `${label}: numero intero`)

// The form works with strings; toPayload converts them. The API validates again.
const formSchema = z.object({
  plate: z.string(),
  make: z.string().max(60, 'Massimo 60 caratteri'),
  model: z.string().max(80, 'Massimo 80 caratteri'),
  version: z.string().max(120, 'Massimo 120 caratteri'),
  fuel: z.string().max(40, 'Massimo 40 caratteri'),
  engineCc: intText('Cilindrata'),
  powerKw: intText('Potenza'),
  euroClass: z.string().max(20, 'Massimo 20 caratteri'),
  color: z.string().max(40, 'Massimo 40 caratteri'),
  registrationDate: z.string(),
  vin: z.string().trim().max(17, 'Il telaio ha 17 caratteri'),
  notes: z.string().max(2_000, 'Massimo 2000 caratteri'),
})
type FormValues = z.infer<typeof formSchema>

const toPayload = (v: FormValues): VehicleFormPayload => {
  const text = (s: string) => s.trim() || null
  const int = (s: string) => (s.trim() ? Number(s) : null)
  return {
    plate: normalizePlate(v.plate),
    make: text(v.make),
    model: text(v.model),
    version: text(v.version),
    fuel: text(v.fuel),
    engineCc: int(v.engineCc),
    powerKw: int(v.powerKw),
    euroClass: text(v.euroClass),
    color: text(v.color),
    registrationDate: v.registrationDate || null,
    vin: text(v.vin)?.toUpperCase() ?? null,
    notes: text(v.notes),
  }
}

type Props = {
  initial?: Partial<VehicleData> & { plate?: string }
  /** The plate can only be set on creation. */
  editablePlate?: boolean
  submitLabel: string
  onSubmit: (payload: VehicleFormPayload) => Promise<void>
  /** Rendered above the submit button (e.g. the assignee picker). */
  children?: ReactNode
}

export function VehicleForm({ initial = {}, editablePlate = false, submitLabel, onSubmit, children }: Props) {
  const [error, setError] = useState<string | null>(null)
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

  const form = useForm({
    defaultValues: {
      plate: str(initial.plate),
      make: str(initial.make),
      model: str(initial.model),
      version: str(initial.version),
      fuel: str(initial.fuel),
      engineCc: str(initial.engineCc),
      powerKw: str(initial.powerKw),
      euroClass: str(initial.euroClass),
      color: str(initial.color),
      registrationDate: str(initial.registrationDate),
      vin: str(initial.vin),
      notes: str(initial.notes),
    } satisfies FormValues,
    validators: { onSubmit: formSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        await onSubmit(toPayload(value))
      } catch (err) {
        setError(errorText(err))
      }
    },
  })

  const field = (name: keyof FormValues, label: string, props: object = {}) => (
    <form.Field name={name}>
      {(f) => (
        <TextField
          label={label}
          value={f.state.value}
          onChange={(e) => f.handleChange(e.target.value)}
          onBlur={f.handleBlur}
          errors={f.state.meta.errors}
          {...props}
        />
      )}
    </form.Field>
  )

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void form.handleSubmit()
      }}
    >
      {editablePlate && (
        <form.Field
          name="plate"
          validators={{ onSubmit: ({ value }) => (normalizePlate(value).length < 5 ? 'Inserisci una targa valida' : undefined) }}
        >
          {(f) => (
            <TextField
              label="Targa"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value.toUpperCase())}
              onBlur={f.handleBlur}
              errors={f.state.meta.errors}
              autoCapitalize="characters"
              autoComplete="off"
              className="font-mono tracking-wider"
            />
          )}
        </form.Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        {field('make', 'Marca')}
        {field('model', 'Modello')}
      </div>
      {field('version', 'Versione / allestimento')}
      <div className="grid grid-cols-2 gap-3">
        {field('fuel', 'Alimentazione', { list: 'fuels' })}
        {field('euroClass', 'Classe Euro', { placeholder: 'Euro 6d' })}
        {field('engineCc', 'Cilindrata (cc)', { inputMode: 'numeric' })}
        {field('powerKw', 'Potenza (kW)', { inputMode: 'numeric' })}
        {field('registrationDate', 'Immatricolazione', { type: 'date' })}
        {field('color', 'Colore')}
      </div>
      {field('vin', 'Telaio (VIN)', { autoCapitalize: 'characters', className: 'font-mono' })}
      {field('notes', 'Note')}
      <datalist id="fuels">
        {FUELS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      {children}
      <FormError message={error} />
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvataggio…' : submitLabel}
          </Button>
        )}
      </form.Subscribe>
    </form>
  )
}
