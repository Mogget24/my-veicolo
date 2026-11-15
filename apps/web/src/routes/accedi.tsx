import { useState } from 'react'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { safeRedirect, signInSchema } from '@my-veicolo/shared/auth'
import { AuthCard, FormError } from '../components/AuthCard'
import { Button } from '../components/Button'
import { TextField } from '../components/TextField'
import { authClient, authErrorMessage, sessionQuery } from '../lib/auth'

export const Route = createFileRoute('/accedi')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  beforeLoad: async ({ context, search }) => {
    const session = await context.queryClient.query(sessionQuery).catch(() => null)
    if (session) throw redirect({ to: safeRedirect(search.redirect) ?? '/' })
  },
  component: SignIn,
})

function SignIn() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setError(null)
      const { error } = await authClient.signIn.email({ email: value.email.trim(), password: value.password })
      if (error) return setError(authErrorMessage(error))
      await queryClient.invalidateQueries()
      await navigate({ to: safeRedirect(search.redirect) ?? '/' })
    },
  })

  return (
    <AuthCard
      title="Accedi"
      subtitle="Bentornato!"
      footer={
        <>
          Non hai un account?{' '}
          <Link to="/registrati" search={search} className="font-medium text-silver-200 underline underline-offset-4">
            Registrati
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
        <form.Field name="email">
          {(field) => (
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              errors={field.state.meta.errors}
            />
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              errors={field.state.meta.errors}
            />
          )}
        </form.Field>
        <FormError message={error} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Accesso in corso…' : 'Accedi'}
            </Button>
          )}
        </form.Subscribe>
        <p className="text-center text-xs text-silver-500">
          Password dimenticata? Chiedi all’amministratore un link di reimpostazione.
        </p>
      </form>
    </AuthCard>
  )
}
