import { useEffect, useRef, useState } from 'react'
import type { User } from 'firebase/auth'
import type { DayEntry, Profile } from '../types'
import { allDays, allFoods, getProfile, putDayRaw, putFoods, putProfile } from './db'
import type { RemoteData } from './firebase'
import { pushAll, pushDay, pushFoods, pushProfile, syncEnabled, watchAuth, watchData } from './firebase'
import { mergeDays, mergeProfile, remoteDays, remoteFoods, unsyncedDays, type SyncState } from './sync'
import { mergeFoods } from './foods'

/**
 * Houdt de lokale opslag en Firebase gelijk. Lokaal blijft leidend voor de UI:
 * schrijven gaat altijd eerst naar IndexedDB, zodat de app zonder verbinding
 * gewoon werkt, en pas daarna naar de server.
 */
export function useCloudSync(onRemoteChange: (days: DayEntry[], profile: Profile) => void) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!syncEnabled)
  const [state, setState] = useState<SyncState>(syncEnabled ? 'syncing' : 'off')
  const firstPull = useRef(true)
  const applying = useRef(false)
  const nogEenKeer = useRef<RemoteData | null | undefined>(undefined)

  useEffect(() => {
    if (!syncEnabled) return
    return watchAuth((u) => {
      setUser(u)
      setAuthReady(true)
      if (!u) setState('off')
    })
  }, [])

  useEffect(() => {
    if (!user) return
    firstPull.current = true
    setState('syncing')

    const verwerk = (data: RemoteData | null) => {
      void (async () => {
        // Komt er een snapshot binnen terwijl we er nog een verwerken, dan mag
        // die niet verdwijnen: we onthouden hem en draaien na afloop opnieuw.
        // Hem laten vallen betekende dat een correctie van de server nooit meer
        // aankwam, en dat de app met de verkeerde waarde bleef staan.
        if (applying.current) {
          nogEenKeer.current = data
          return
        }
        applying.current = true
        try {
          const [localDays, localProfile, localFoods] = await Promise.all([
            allDays(),
            getProfile(),
            allFoods(),
          ])
          const incoming = remoteDays(data)
          const merged = mergeDays(localDays, incoming)
          const profile = mergeProfile(localProfile, data?.profile)

          const foods = mergeFoods(localFoods, remoteFoods(data))
          await putFoods(foods)

          // Alleen wegschrijven wat werkelijk verandert. Alles terugschrijven
          // was honderden transacties per snapshot, en dat maakte het raam
          // waarin een bewerking kon kwijtraken onnodig groot.
          const lokaalPerDatum = new Map(localDays.map((d) => [d.date, d]))
          for (const day of merged) {
            const bestaand = lokaalPerDatum.get(day.date)
            if (!bestaand || (bestaand.updatedAt ?? 0) < (day.updatedAt ?? 0)) await putDayRaw(day)
          }
          if (profile !== localProfile) await putProfile(profile)
          onRemoteChange(merged, profile)

          // Bij de eerste sync na inloggen duwen we alles omhoog wat hier
          // nieuwer is — anders zou een apparaat dat offline is bijgehouden
          // stilletjes overschreven worden door de server.
          if (firstPull.current) {
            firstPull.current = false
            if (!data) await pushAll(user.uid, profile, merged)
            else {
              const behind = unsyncedDays(merged, incoming)
              await Promise.all(behind.map((d) => pushDay(user.uid, d)))
              if (profile !== data.profile) await pushProfile(user.uid, profile)
            }
            await pushFoods(user.uid, foods)
          }
          setState(navigator.onLine ? 'synced' : 'offline')
        } catch {
          setState('error')
        } finally {
          applying.current = false
          const overgeslagen = nogEenKeer.current
          if (overgeslagen !== undefined) {
            nogEenKeer.current = undefined
            verwerk(overgeslagen)
          }
        }
      })()
    }

    return watchData(user.uid, verwerk)
  }, [user, onRemoteChange])

  useEffect(() => {
    const online = () => setState(user ? 'syncing' : 'off')
    const offline = () => setState(user ? 'offline' : 'off')
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [user])

  const syncDay = async (day: DayEntry) => {
    if (!user) return
    setState('syncing')
    try {
      await pushDay(user.uid, day)
      setState('synced')
    } catch {
      setState(navigator.onLine ? 'error' : 'offline')
    }
  }

  /** De lijst is klein; in zijn geheel wegschrijven is simpeler dan per item. */
  const syncFoods = async () => {
    if (!user) return
    try {
      await pushFoods(user.uid, await allFoods())
    } catch {
      /* lokaal staat het al; de volgende sync haalt het in */
    }
  }

  const syncProfile = async (profile: Profile) => {
    if (!user) return
    try {
      await pushProfile(user.uid, profile)
    } catch {
      /* lokaal is al opgeslagen; de eerstvolgende sync haalt het in */
    }
  }

  return { user, authReady, state, syncDay, syncProfile, syncFoods }
}
