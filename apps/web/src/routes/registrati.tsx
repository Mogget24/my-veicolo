import { useState } from 'react'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { PASSWORD_MIN_LENGTH, safeRedirect, signUpSchema } from '@my-veicolo/shared'
import { AuthCard, FormError } from '../components/AuthCard'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { authClient, authErrorMessage, sessionQuery } from '../lib/auth'

export const Route = createFileRoute('/registrati')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.query(sessionQuery).catch(() => null)
    if (session) throw redirect({ to: '/' })
  },
  component: SignUp,
})

function SignUp() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
    validators: { onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await authClient.signUp.email({
        name: value.name.trim(),
        email: value.email.trim(),
        password: value.password,
      })
      if (error) return setError(authErrorMessage(error))
      await queryClient.invalidateQueries()
      await navigate({ to: safeRedirect(search.redirect) ?? '/' })
    },
  })

  const field = (name: 'name' | 'email' | 'password' | 'confirmPassword', label: string, props: object) => (
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
    <AuthCard
      title="Crea un account"
      subtitle="Dopo la registrazione l’amministratore ti assegnerà i tuoi veicoli"
      footer={
        <>
          Hai già un account?{' '}
          <Link to="/accedi" search={search} className="font-medium text-silver-200 underline underline-offset-4">
            Accedi
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        {field('name', 'Nome', { autoComplete: 'name', autoCapitalize: 'words' })}
        {field('email', 'Email', { type: 'email', autoComplete: 'email', inputMode: 'email', autoCapitalize: 'none' })}
        {field('password', 'Password', {
          type: 'password',
          autoComplete: 'new-password',
          placeholder: `Almeno ${PASSWORD_MIN_LENGTH} caratteri`,
        })}
        {field('confirmPassword', 'Conferma password', { type: 'password', autoComplete: 'new-password' })}
        <FormError message={error} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Registrazione in corso…' : 'Registrati'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthCard>
  )
}
