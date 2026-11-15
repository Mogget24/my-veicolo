type PickerUser = { id: string; name: string; email: string; banned: boolean | null }

/** Checkbox list of users to assign a vehicle to. Banned users are hidden unless already selected. */
export function AssigneePicker({
  users,
  value,
  onChange,
}: {
  users: PickerUser[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const visible = users.filter((u) => !u.banned || value.includes(u.id))
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 text-sm font-medium text-silver-300">Assegna a</legend>
      {visible.length === 0 && <p className="text-sm text-silver-500">Nessun utente registrato.</p>}
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
        {visible.map((u) => (
          <li key={u.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/5 active:bg-white/10">
              <input
                type="checkbox"
                checked={value.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="size-4 accent-silver-300"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm">{u.name}</span>
                <span className="block truncate text-xs text-silver-400">{u.email}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
