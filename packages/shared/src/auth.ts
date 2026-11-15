import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

const email = z.string().trim().min(1, 'Inserisci la tua email').pipe(z.email('Email non valida'))

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Inserisci la password'),
})
export type SignInInput = z.infer<typeof signInSchema>

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, 'Inserisci il tuo nome').max(80, 'Nome troppo lungo'),
    email,
    password: z.string().min(PASSWORD_MIN_LENGTH, `Almeno ${PASSWORD_MIN_LENGTH} caratteri`).max(128, 'Password troppo lunga'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Le password non coincidono',
    path: ['confirmPassword'],
  })
export type SignUpInput = z.infer<typeof signUpSchema>

export const resetPasswordSchema = z
  .object({
    password: z.string().min(PASSWORD_MIN_LENGTH, `Almeno ${PASSWORD_MIN_LENGTH} caratteri`).max(128, 'Password troppo lunga'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Le password non coincidono',
    path: ['confirmPassword'],
  })

/** Only same-app paths are allowed as post-login redirects (no open redirects). */
export const safeRedirect = (value: unknown): string | undefined =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
    ? value
    : undefined
