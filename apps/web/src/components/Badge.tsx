const tones = {
  neutral: 'border-silver-700 bg-silver-900 text-silver-200',
  danger: 'border-red-800 bg-red-950 text-red-200',
  success: 'border-emerald-800 bg-emerald-950 text-emerald-200',
  warning: 'border-amber-800 bg-amber-950 text-amber-200',
} as const

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
}
