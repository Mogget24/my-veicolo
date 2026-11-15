import { useId, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  /** Validation errors (Standard Schema issues or strings); the first one is shown. */
  errors?: ReadonlyArray<{ message?: string } | string | undefined>
}

export function TextField({ label, errors = [], className = '', ...input }: Props) {
  const id = useId()
  const first = errors.find(Boolean)
  const error = typeof first === 'string' ? first : first?.message

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-silver-300">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={
          'block w-full rounded-lg border border-silver-800 bg-surface px-3 py-2.5 text-base text-silver-100 ' +
          'placeholder:text-silver-600 transition-colors ' +
          'focus:border-silver-400 focus:outline-none focus:ring-2 focus:ring-silver-400/30 ' +
          'aria-invalid:border-red-400 ' +
          className
        }
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
