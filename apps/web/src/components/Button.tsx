import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'outline' | 'ghost'

// Disabled buttons get pointer-events-none, so hover/active never fire on them.
// That keeps the same classes valid for <a>/<Link> styled as buttons.
const base =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-medium select-none ' +
  'transition duration-100 ease-out touch-manipulation active:scale-[0.97] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 ' +
  'disabled:pointer-events-none disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white hover:bg-teal-800 active:bg-teal-900',
  outline:
    'border border-teal-700 text-teal-700 hover:bg-teal-50 active:bg-teal-100 ' +
    'dark:text-teal-400 dark:hover:bg-teal-950 dark:active:bg-teal-900',
  ghost: 'text-slate-300 hover:bg-white/10 active:bg-white/20',
}

/** Button classes, also usable on <a>/<Link>. */
export const buttonClass = (variant: Variant = 'primary', extra = '') => `${base} ${variants[variant]} ${extra}`

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: Props) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />
}
