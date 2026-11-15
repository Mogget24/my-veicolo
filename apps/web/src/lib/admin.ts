import { queryOptions } from '@tanstack/react-query'
import { api } from './api'
import { apiError } from './http'

/** All admin queries share the ['admin'] prefix: invalidate it after any admin change. */
export const adminUsersQuery = queryOptions({
  queryKey: ['admin', 'users'],
  queryFn: async () => {
    const res = await api.admin.users.$get()
    if (!res.ok) throw await apiError(res, 'Impossibile caricare gli utenti')
    return (await res.json()).users
  },
})

export const adminUserQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'users', id],
    queryFn: async () => {
      const res = await api.admin.users[':id'].$get({ param: { id } })
      if (!res.ok) throw await apiError(res, 'Utente non trovato')
      return res.json()
    },
  })

export const adminVehiclesQuery = queryOptions({
  queryKey: ['admin', 'vehicles'],
  queryFn: async () => {
    const res = await api.admin.vehicles.$get()
    if (!res.ok) throw await apiError(res, 'Impossibile caricare i veicoli')
    return (await res.json()).vehicles
  },
})

export const adminVehicleQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'vehicles', id],
    queryFn: async () => {
      const res = await api.admin.vehicles[':id'].$get({ param: { id } })
      if (!res.ok) throw await apiError(res, 'Veicolo non trovato')
      return res.json()
    },
  })

export const costsQuery = queryOptions({
  queryKey: ['admin', 'costs'],
  queryFn: async () => {
    const res = await api.admin.plates.costs.$get()
    if (!res.ok) throw await apiError(res, 'Impossibile caricare i costi')
    return res.json()
  },
})

/** Replaces the users assigned to a vehicle. */
export async function setAssignees(vehicleId: string, userIds: string[]) {
  const res = await api.admin.vehicles[':id'].assignments.$put({ param: { id: vehicleId }, json: { userIds } })
  if (!res.ok) throw await apiError(res, 'Assegnazione non riuscita')
  return res.json()
}

export const euro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
export const dateFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
export const dateTimeFmt = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short' })
