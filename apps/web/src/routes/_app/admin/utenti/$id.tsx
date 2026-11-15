import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { APP_NAME } from '@my-veicolo/shared/brand'
import { FormError } from '../../../../components/AuthCard'
import { Badge } from '../../../../components/Badge'
import { Button } from '../../../../components/Button'
import { Plate } from '../../../../components/Plate'
import { adminUserQuery, adminVehiclesQuery, dateFmt, dateTimeFmt, setAssignees } from '../../../../lib/admin'
import { api } from '../../../../lib/api'
import { authClient } from '../../../../lib/auth'
import { apiError, errorText } from '../../../../lib/http'

export const Route = createFileRoute('/_app/admin/utenti/$id')({
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.query({ ...adminUserQuery(params.id), staleTime: 'static' }),
      context.queryClient.query({ ...adminVehiclesQuery, staleTime: 'static' }),
    ]),
  component: UserDetail,
})

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-semibold text-silver-200">{title}</h2>
      {children}
    </section>
  )
}

function UserDetail() {
  const { id } = Route.useParams()
  const { session } = Route.useRouteContext()
  const queryClient = useQueryClient()
  const { data } = useQuery(adminUserQuery(id))
  const { data: allVehicles = [] } = useQuery(adminVehiclesQuery)
  const [error, setError] = useState<string | null>(null)
  const [toAssign, setToAssign] = useState('')
  const [resetLink, setResetLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const action = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onMutate: () => setError(null),
    onError: (err) => setError(errorText(err)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  })

  if (!data) return null
  const { user, vehicles } = data
  const isSelf = user.id === session.user.id
  const assignable = allVehicles.filter((v) => !vehicles.some((a) => a.id === v.id))

  const changeAssignment = (vehicleId: string, assign: boolean) =>
    action.mutate(async () => {
      const current = allVehicles.find((v) => v.id === vehicleId)?.assignees.map((a) => a.id) ?? []
      await setAssignees(vehicleId, assign ? [...current, user.id] : current.filter((u) => u !== user.id))
      setToAssign('')
    })

  const authCall = (fn: () => Promise<{ error: { message?: string } | null }>) =>
    action.mutate(async () => {
      const { error } = await fn()
      if (error) throw new Error(error.message ?? 'Operazione non riuscita')
    })

  const createResetLink = () =>
    action.mutate(async () => {
      const res = await api.admin.users[':id']['reset-link'].$post({ param: { id: user.id } })
      if (!res.ok) throw await apiError(res, 'Impossibile creare il link')
      setResetLink(await res.json())
      setCopied(false)
    })

  const shareText = resetLink && `Ciao ${user.name}, ecco il link per reimpostare la password di ${APP_NAME}: ${resetLink.url}`

  return (
    <div className="space-y-4">
      <Link to="/admin" className="text-sm text-silver-400 hover:text-silver-200">
        ← Utenti
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">{user.name}</h1>
          <p className="truncate text-silver-400">{user.email}</p>
          <p className="text-xs text-silver-500">
            Iscritto il {dateFmt.format(new Date(user.createdAt))} · Notifiche:{' '}
            {user.pushDevices > 0 ? `${user.pushDevices} dispositiv${user.pushDevices === 1 ? 'o' : 'i'}` : 'non attive'}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {user.role === 'admin' && <Badge>Admin</Badge>}
          {user.banned && <Badge tone="danger">Sospeso</Badge>}
        </div>
      </div>

      <FormError message={error} />

      <Section title="Veicoli assegnati">
        {vehicles.length === 0 && <p className="text-sm text-amber-300">Nessun veicolo assegnato.</p>}
        <ul className="space-y-2">
          {vehicles.map((v) => (
            <li key={v.id} className="flex items-center gap-3">
              <Link to="/admin/veicoli/$id" params={{ id: v.id }} className="flex min-w-0 flex-1 items-center gap-3">
                <Plate value={v.plate} />
                <span className="truncate text-sm">{[v.make, v.model].filter(Boolean).join(' ')}</span>
              </Link>
              <Button variant="ghost" className="px-2 py-1 text-sm" disabled={action.isPending} onClick={() => changeAssignment(v.id, false)}>
                Rimuovi
              </Button>
            </li>
          ))}
        </ul>
        {assignable.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={toAssign}
              onChange={(e) => setToAssign(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-silver-800 bg-bg px-3 py-2.5 text-silver-100 focus:border-silver-400 focus:outline-none"
            >
              <option value="">Scegli un veicolo…</option>
              {assignable.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {[v.make, v.model].filter(Boolean).join(' ') || 'Veicolo'}
                </option>
              ))}
            </select>
            <Button disabled={!toAssign || action.isPending} onClick={() => changeAssignment(toAssign, true)}>
              Assegna
            </Button>
          </div>
        ) : (
          <p className="text-sm text-silver-500">
            {allVehicles.length === 0 ? 'Non ci sono ancora veicoli. ' : 'Tutti i veicoli sono già assegnati a questo utente. '}
            <Link to="/admin/veicoli/nuovo" className="text-silver-200 underline underline-offset-4">
              Aggiungi un veicolo
            </Link>
          </p>
        )}
      </Section>

      <Section title="Password dimenticata">
        <p className="text-sm text-silver-400">
          Crea un link valido 24 ore e invialo all’utente (WhatsApp, Telegram…). Funziona una sola volta e disconnette tutti
          i suoi dispositivi.
        </p>
        {resetLink && shareText ? (
          <div className="space-y-2">
            <p className="break-all rounded-lg border border-line bg-bg p-3 font-mono text-xs text-silver-200">{resetLink.url}</p>
            <p className="text-xs text-silver-500">Scade il {dateTimeFmt.format(new Date(resetLink.expiresAt))}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={async () => {
                  await navigator.clipboard.writeText(resetLink.url)
                  setCopied(true)
                }}
              >
                {copied ? 'Copiato ✓' : 'Copia link'}
              </Button>
              {'share' in navigator && (
                <Button className="flex-1" onClick={() => navigator.share({ title: APP_NAME, text: shareText }).catch(() => {})}>
                  Condividi
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" disabled={action.isPending} onClick={createResetLink}>
            Crea link per reimpostare la password
          </Button>
        )}
      </Section>

      <Section title="Ruolo e accesso">
        {isSelf ? (
          <p className="text-sm text-silver-500">Non puoi cambiare il tuo ruolo o sospendere te stesso.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                const role = user.role === 'admin' ? 'user' : 'admin'
                const msg = role === 'admin' ? `Rendere ${user.name} amministratore?` : `Togliere a ${user.name} il ruolo di amministratore?`
                if (confirm(msg)) authCall(() => authClient.admin.setRole({ userId: user.id, role }))
              }}
            >
              {user.role === 'admin' ? 'Rimuovi ruolo admin' : 'Rendi amministratore'}
            </Button>
            {user.banned ? (
              <Button variant="outline" disabled={action.isPending} onClick={() => authCall(() => authClient.admin.unbanUser({ userId: user.id }))}>
                Riattiva account
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={action.isPending}
                onClick={() => {
                  if (confirm(`Sospendere ${user.name}? Verrà disconnesso da tutti i dispositivi.`)) {
                    authCall(() => authClient.admin.banUser({ userId: user.id }))
                  }
                }}
              >
                Sospendi account
              </Button>
            )}
          </div>
        )}
      </Section>
    </div>
  )
}
