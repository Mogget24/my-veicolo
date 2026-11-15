import { formatPlate } from '@my-veicolo/shared/plate'

/** Italian-style plate badge: [I] AB 123 CD. */
export function Plate({ value, size = 'md' }: { value: string; size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-xl px-3 py-1.5' : 'text-sm px-2 py-1'
  return (
    <span className="inline-flex shrink-0 overflow-hidden rounded-md border border-silver-400 bg-silver-50 font-mono font-bold tracking-wider text-bg">
      <span className="flex items-end bg-blue-700 px-1 pb-0.5 font-sans text-[9px] font-semibold text-white">I</span>
      <span className={text}>{formatPlate(value)}</span>
    </span>
  )
}
