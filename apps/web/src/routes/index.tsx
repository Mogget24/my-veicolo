import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { buttonClass } from '../components/Button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.health.$get()
      if (!res.ok) throw new Error('API non raggiungibile')
      return res.json()
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">I miei veicoli</h1>
      <p className="text-silver-400">
        Fase 0: scheletro dell'app. Qui comparirà l'elenco dei veicoli assegnati.
      </p>
      <p className="text-sm">
        Stato API: {health.isPending ? 'verifica…' : health.isError ? '❌ non raggiungibile' : '✅ online'}
      </p>
      <Link to="/push-test" className={buttonClass('primary')}>
        Prova le notifiche
      </Link>
    </div>
  )
}
