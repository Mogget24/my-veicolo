import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQuery } from '@tanstack/react-query'
import { PASSWORD_MIN_LENGTH, resetPasswordSchema } from '@my-veicolo/shared/auth'
import { AuthCard, FormError } from '../components/AuthCard'
import { Button, buttonClass } from '../components/Button'
import { TextField } from '../components/TextField'
import { api } from '../lib/api'
import { apiError, errorText } from '../lib/http'

/** Public page opened from the link an admin sends by WhatsApp/Telegram. */
export const Route = createFileRoute('/reimposta-password/$token')({ component: ResetPassword })

function ResetPassword() {
  const { token } = Route.useParams()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const link = useQuery({
    queryKey: ['password-reset', token],
    queryFn: async () => {
      const res = await api['password-reset'][':token'].$get({ param: { token } })
      if (!res.ok) throw await apiError(res, 'Link non valido')
      return res.json()
    },
    retry: false,
  })

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      try {
        const res = await api['password-reset'][':token'].$post({ param: { token }, json: { password: value.password } })
        if (!res.ok) throw await apiError(res, 'Reimpostazione non riuscita')
        setDone(true)
      } catch (err) {
        setError(errorText(err))
      }
    },
  })

  if (done) {
    return (
      <AuthCard title="Password aggiornata" subtitle="Ora puoi accedere con la nuova password.">
        <Link to="/accedi" search={{}} className={buttonClass('primary', 'w-full')}>
          Accedi
        </Link>
      </AuthCard>
    )
  }

  if (link.isError) {
    return (
      <AuthCard title="Link non valido" subtitle={errorText(link.error)}>
        <Link to="/accedi" search={{}} className={buttonClass('outline', 'w-full')}>
          Vai all’accesso
        </Link>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Nuova password" subtitle={link.data ? `Per ${link.data.email}` : 'Verifica del link…'}>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        {/* Lets password managers save the new password for the right account. */}
        <input type="email" name="email" autoComplete="username" value={link.data?.email ?? ''} readOnly hidden />
        <form.Field name="password">
          {(f) => (
            <TextField
              label="Nuova password"
              type="password"
              autoComplete="new-password"
              placeholder={`Almeno ${PASSWORD_MIN_LENGTH} caratteri`}
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              errors={f.state.meta.errors}
            />
          )}
        </form.Field>
        <form.Field name="confirmPassword">
          {(f) => (
            <TextField
              label="Conferma password"
              type="password"
              autoComplete="new-password"
              value={f.state.value}
              onChange={(e) => f.handleChange(e.target.value)}
              onBlur={f.handleBlur}
              errors={f.state.meta.errors}
            />
          )}
        </form.Field>
        <FormError message={error} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full" disabled={isSubmitting || !link.data}>
              {isSubmitting ? 'Salvataggio…' : 'Salva nuova password'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthCard>
  )
}
