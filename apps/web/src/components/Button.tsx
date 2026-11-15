import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'

// Disabled buttons get pointer-events-none, so hover/active never fire on them.
// That keeps the same classes valid for <a>/<Link> styled as buttons.
const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium select-none ' +
  'transition duration-100 ease-out touch-manipulation active:scale-[0.97] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-silver-300 ' +
  'disabled:pointer-events-none disabled:opacity-40'

const variants: Record<Variant, string> = {
  primary: 'bg-silver-300 text-bg hover:bg-silver-200 active:bg-silver-400',
  outline: 'border border-silver-500 text-silver-200 hover:bg-white/5 active:bg-white/10',
  ghost: 'text-silver-300 hover:bg-white/5 active:bg-white/10',
  /** Destructive actions (delete, suspend). red-300 on bg: 10.3:1. */
  danger: 'border border-red-800 text-red-300 hover:bg-red-950/50 active:bg-red-950',
}

/** Button classes, also usable on <a>/<Link>. */
export const buttonClass = (variant: Variant = 'primary', extra = '') => `${base} ${variants[variant]} ${extra}`

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: Props) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}
