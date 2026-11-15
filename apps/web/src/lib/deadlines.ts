import { queryOptions } from '@tanstack/react-query'
import { formatDateIt, type IsoDate } from '@my-veicolo/shared/dates'
import type { DeadlineStatus, DeadlineType } from '@my-veicolo/shared/deadline'
import { api } from './api'
import { apiError } from './http'

export const vehicleDeadlinesQuery = (vehicleId: string) =>
  queryOptions({
    queryKey: ['deadlines', 'vehicle', vehicleId],
    queryFn: async () => {
      const res = await api.vehicles[':id'].deadlines.$get({ param: { id: vehicleId } })
      if (!res.ok) throw await apiError(res, 'Impossibile caricare le scadenze')
      return (await res.json()).deadlines
    },
  })

export const myDeadlinesQuery = queryOptions({
  queryKey: ['deadlines', 'mine'],
  queryFn: async () => {
    const res = await api.deadlines.$get()
    if (!res.ok) throw await apiError(res, 'Impossibile caricare le scadenze')
    return (await res.json()).deadlines
  },
})

export const deadlineQuery = (id: string) =>
  queryOptions({
    queryKey: ['deadlines', 'one', id],
    queryFn: async () => {
      const res = await api.deadlines[':id'].$get({ param: { id } })
      if (!res.ok) throw await apiError(res, 'Scadenza non trovata')
      return res.json()
    },
  })

/** Short status text for badges. "Scaduta" agrees with "scadenza" (feminine). */
export function statusText(status: DeadlineStatus, days: number | null, dueDate: IsoDate | null): string {
  switch (status) {
    case 'unset':
      return 'Data da impostare'
    case 'overdue':
      return `Scaduta da ${-days!} giorn${days === -1 ? 'o' : 'i'}`
    case 'today':
      return 'Scade oggi'
    case 'soon':
      return days === 1 ? 'Domani' : `Tra ${days} giorni`
    case 'ok':
      return formatDateIt(dueDate!)
  }
}

export const statusTone = (status: DeadlineStatus) =>
  status === 'overdue' || status === 'today' ? 'danger' : status === 'soon' ? 'warning' : 'neutral'

/**
 * Free official checks (no login). The user opens them, solves any captcha there and brings
 * the result back by typing or pasting it; we never query these sites ourselves.
 */
export type OfficialCheck = { title: string; url: (plate: string) => string; prefillsPlate: boolean; hint: string }

const PORTALE = 'https://www.ilportaledellautomobilista.it/web/portale-automobilista'

export const OFFICIAL_CHECKS: Partial<Record<DeadlineType, OfficialCheck>> = {
  revisione: {
    title: 'Portale dell’Automobilista · revisioni',
    url: () => `${PORTALE}/verifica-revisioni-effettuate-ms`,
    prefillsPlate: false,
    hint: 'Mostra data, esito e km dell’ultima revisione.',
  },
  rca: {
    title: 'Portale dell’Automobilista · copertura RCA',
    url: () => `${PORTALE}/ext/verifica-copertura-rc`,
    prefillsPlate: false,
    hint: 'Mostra la compagnia e la data di scadenza della polizza.',
  },
  bollo: {
    title: 'ACI · calcolo bollo',
    url: (plate) => `https://online.aci.it/acinet/calcolobollo/Categoria.asp?Targa=${encodeURIComponent(plate)}&TipoPagamento=01&TipoVeicolo=1`,
    prefillsPlate: true,
    hint: 'Mostra l’importo e il periodo da pagare (per alcune regioni serve il sito regionale).',
  },
}

/** Label of the "who did it" field in the renew form. */
export const companyLabel: Partial<Record<DeadlineType, string>> = {
  rca: 'Compagnia',
  revisione: 'Officina / centro revisioni',
  tagliando: 'Officina',
  gomme: 'Gommista',
}

/** Types where the odometer reading is worth recording. */
export const recordsKm: DeadlineType[] = ['revisione', 'tagliando', 'gomme']
