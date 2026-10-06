import type { DayEntry, ISODate, Profile } from '../types'
import { defaultProfile, normalizeDay } from '../types'
import type { RemoteData } from './firebase'

/**
 * Dagen zijn onafhankelijk van elkaar, dus samenvoegen kan per dag: van elke
 * datum wint de versie die het laatst is bijgewerkt. Twee apparaten die
 * verschillende dagen invullen raken elkaar dus nooit; bewerk je op beide
 * dezelfde dag, dan wint de laatste bewerking — en alleen voor die ene dag.
 */
export function mergeDays(local: DayEntry[], remote: DayEntry[]): DayEntry[] {
  const byDate = new Map<ISODate, DayEntry>()
  for (const day of local) byDate.set(day.date, day)
  for (const day of remote) {
    const mine = byDate.get(day.date)
    if (!mine || (day.updatedAt ?? 0) > (mine.updatedAt ?? 0)) byDate.set(day.date, day)
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Wat er op het scherm komt te staan als de sync een nieuwe stand aanlevert.
 *
 * Nadrukkelijk samenvoegen en niet vervangen. De sync leest de opslag, rekent
 * even, en komt dan terug met een lijst — maar in die tussentijd kun jij alweer
 * iets hebben ingetypt. Die lijst er klakkeloos overheen zetten gooit je laatste
 * bewerking weg: je typt 1881, de sync was vertrokken toen er 188 stond, en bij
 * terugkomst staat er weer 188. Per dag wint de versie die het laatst is
 * bijgewerkt, dus je eigen bewerking van een seconde geleden wint.
 */
export const applyRemoteDays = (huidig: DayEntry[], vanSync: DayEntry[]): DayEntry[] =>
  mergeDays(huidig, vanSync).filter((d) => !d.deleted)

export function mergeProfile(local: Profile, remote: Profile | undefined): Profile {
  if (!remote) return local
  return (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)
    ? { ...defaultProfile, ...remote }
    : local
}

export const remoteDays = (data: RemoteData | null): DayEntry[] =>
  data?.days ? Object.values(data.days).filter((d) => d?.date).map(normalizeDay) : []

/** Dagen die lokaal nieuwer zijn dan wat er op de server staat. */
export function unsyncedDays(local: DayEntry[], remote: DayEntry[]): DayEntry[] {
  const remoteByDate = new Map(remote.map((d) => [d.date, d]))
  return local.filter((d) => {
    const theirs = remoteByDate.get(d.date)
    return !theirs || (d.updatedAt ?? 0) > (theirs.updatedAt ?? 0)
  })
}

export type SyncState = 'off' | 'offline' | 'syncing' | 'synced' | 'error'

export const syncLabel: Record<SyncState, string> = {
  off: 'Sync staat uit — je data blijft op dit toestel',
  offline: 'Geen verbinding — wijzigingen worden lokaal bewaard en later gesynct',
  syncing: 'Bezig met synchroniseren',
  synced: 'Alles gesynchroniseerd',
  error: 'Synchroniseren mislukt — je data staat nog wel lokaal',
}

export const remoteFoods = (data: RemoteData | null) =>
  data?.foods ? Object.values(data.foods).filter((f) => f?.key) : []
