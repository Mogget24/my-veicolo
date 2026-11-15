import type { ReactNode } from 'react'

/** Centered layout for the login and sign-up pages. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <img src="/icon.svg" alt="" className="size-16 rounded-2xl shadow-lg shadow-black/40" />
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-silver-400">{subtitle}</p>}
      </div>
      <div className="rounded-2xl border border-line bg-surface/60 p-5">{children}</div>
      {footer && <div className="mt-6 text-center text-sm text-silver-400">{footer}</div>}
    </div>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
      {message}
    </p>
  )
}
