import { useEffect, useRef, useState } from 'react'
import type { DayEntry, Profile, Settings } from '../types'
import { emptyDay, normalizeDay } from '../types'
import { Card, NumberField, TextField } from '../components/inputs'
import { allFoods, deleteFood, exportAll, getDay, importAll, putDay, putFoods } from '../lib/db'
import { foodKey, hernoemItem, type FoodItem } from '../lib/foods'
import { ageAt, birthDateForAge, shiftISO, todayISO } from '../lib/derive'
import { PIN_LENGTH, biometricsAvailable, hashPin, registerBiometrics } from '../lib/lock'
import { claudeSummary } from '../lib/share'
import { logout, syncEnabled } from '../lib/firebase'
import { syncLabel, type SyncState } from '../lib/sync'
import type { User } from 'firebase/auth'

type Props = {
  profile: Profile
  settings: Settings
  days: DayEntry[]
  user: User | null
  syncState: SyncState
  onProfile: (p: Profile) => void
  onSettings: (s: Settings) => void
  onReload: () => Promise<void>
  onLoginAgain: () => void
  onFoodsChanged: () => void
  onImported: () => Promise<void>
}

export default function SettingsScreen({
  profile,
  settings,
  days,
  user,
  syncState,
  onProfile,
  onSettings,
  onReload,
  onLoginAgain,
  onFoodsChanged,
  onImported,
}: Props) {
  const [msg, setMsg] = useState('')
  const [pin, setPin] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const share = async () => {
    const text = claudeSummary(days, profile)
    const file = new File([text], `gezondheid-${todayISO()}.md`, { type: 'text/markdown' })
    try {
      // Web Share Level 2 — hiermee kun je het bestand rechtstreeks aan de Claude-app geven.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Mijn gezondheidsdata' })
        return
      }
      if (navigator.share) {
        await navigator.share({ title: 'Mijn gezondheidsdata', text })
        return
      }
      await copy()
    } catch (e) {
      // een geannuleerd deelvenster is geen fout
      if (e instanceof Error && e.name !== 'AbortError') setMsg('Delen mislukt: ' + e.message)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(claudeSummary(days, profile))
      setMsg('Samenvatting gekopieerd — plak hem in een Claude-gesprek.')
    } catch {
      setMsg('Kopiëren mislukt. Gebruik de exportknop hieronder.')
    }
  }

  /**
   * Een back-up maken. Eerst via het deelmenu, want een gewone downloadlink doet
   * in een app op het beginscherm van een iPhone vaak helemaal niets. Via het
   * deelmenu kies je 'Bewaar in Bestanden'. Werkt dat niet, dan alsnog de
   * downloadlink — en die link wordt pas na een tijdje vrijgegeven, omdat iOS
   * hem anders al kwijt is voordat de download begint.
   */
  const download = async () => {
    const data = await exportAll()
    const naam = `gezondheid-${todayISO()}.json`
    const file = new File([JSON.stringify(data, null, 2)], naam, { type: 'application/json' })
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Back-up gezondheid' })
        return
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    }
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = naam
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const upload = async (file: File) => {
    try {
      const count = await importAll(JSON.parse(await file.text()))
      await onReload()
      setMsg(`${count} dagen samengevoegd met wat er al stond. Bezig met naar de server sturen…`)
      // Een import schreef vroeger alleen lokaal. Na het redden van oude data
      // wil je die juist op de server hebben, dus alles meteen omhoog.
      await onImported()
      setMsg(`${count} dagen samengevoegd en naar de server gestuurd.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Import mislukt.')
    }
  }

  const setPinCode = async () => {
    onSettings({ ...settings, pinHash: await hashPin(pin) })
    setPin('')
    setMsg('PIN ingesteld.')
  }

  const enableBiometrics = async () => {
    try {
      const id = await registerBiometrics()
      onSettings({ ...settings, biometricCredentialId: id })
      setMsg('Face ID / Touch ID ingeschakeld.')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Instellen mislukt.')
    }
  }

  return (
    <>
      {syncEnabled && (
        <Card title="Synchronisatie">
          {user ? (
            <>
              <p className="note">
                Ingelogd als <strong>{user.email ?? 'onbekend account'}</strong>.{' '}
                {syncLabel[syncState]}.
              </p>
              <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => void logout()}>
                Uitloggen
              </button>
            </>
          ) : (
            <>
              <p className="note">
                Je werkt nu alleen op dit toestel. Log in om je dagen te delen met je andere
                apparaten — wat hier al staat wordt daarbij meegenomen.
              </p>
              <button className="btn" style={{ marginTop: 12 }} onClick={onLoginAgain}>
                Inloggen
              </button>
            </>
          )}
        </Card>
      )}

      <Card title="Profiel">
        <div className="fields">
          <NumberField
            label="Leeftijd"
            unit="jaar"
            value={ageAt(profile, todayISO())}
            onChange={(v) =>
              v != null &&
              v > 0 &&
              v < 120 &&
              onProfile({ ...profile, birthDate: birthDateForAge(profile.birthDate, v) })
            }
          />
          <NumberField
            label="Lengte"
            unit="m"
            step={0.01}
            value={profile.heightM}
            onChange={(v) => v && onProfile({ ...profile, heightM: v })}
          />
          <NumberField
            label="Streefgewicht"
            unit="kg"
            step={0.01}
            decimals={2}
            value={profile.targetWeightKg}
            onChange={(v) => v && onProfile({ ...profile, targetWeightKg: v })}
          />
          <NumberField
            label="Caloriedoel"
            unit="kcal"
            step={50}
            value={profile.calorieGoalKcal}
            onChange={(v) => v && onProfile({ ...profile, calorieGoalKcal: v })}
          />
          <NumberField
            label="Beweegdoel"
            unit="min/week"
            step={15}
            value={profile.exerciseGoalWeek}
            onChange={(v) => v && onProfile({ ...profile, exerciseGoalWeek: v })}
          />
          <NumberField
            label="Krachttraining"
            unit="keer/week"
            value={profile.strengthGoalWeek}
            onChange={(v) => v && onProfile({ ...profile, strengthGoalWeek: v })}
          />
          <NumberField
            label="Waterdoel"
            unit="ml"
            step={100}
            value={profile.waterGoalMl}
            onChange={(v) => v && onProfile({ ...profile, waterGoalMl: v })}
          />
          <div className="field">
            <label>Geslacht (voor BMR-schatting)</label>
            <select
              value={profile.sex ?? ''}
              onChange={(e) =>
                onProfile({
                  ...profile,
                  sex: e.target.value === '' ? undefined : (e.target.value as 'male' | 'female'),
                })
              }
            >
              <option value="">Niet ingevuld</option>
              <option value="male">Man</option>
              <option value="female">Vrouw</option>
            </select>
          </div>
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          Je leeftijd telt vanzelf op zodra je jarig bent — je geboortedag blijft onderwater
          bewaard. Geslacht is alleen nodig voor de basaalverbruik-schatting; zonder invulling
          wordt die simpelweg niet getoond.
        </p>
      </Card>

      <FoodsCard onChanged={onFoodsChanged} />

      <Card title="Slot">
        <p className="note" style={{ marginBottom: 12 }}>
          {settings.pinHash
            ? 'Er staat een PIN op de app.'
            : 'Zonder PIN opent de app direct. Dit is een deur, geen kluis: de data zelf is niet met de PIN versleuteld.'}
        </p>
        <div className="row">
          <input
            type="password"
            inputMode="numeric"
            placeholder={`Nieuwe PIN (${PIN_LENGTH} cijfers)`}
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH))}
            style={{
              border: '1px solid var(--grey-200)',
              borderRadius: 10,
              padding: '10px 12px',
              flex: 1,
              minWidth: 140,
            }}
          />
          <button className="btn" disabled={pin.length !== PIN_LENGTH} onClick={setPinCode}>
            Instellen
          </button>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          {biometricsAvailable() && (
            <button className="btn secondary" onClick={enableBiometrics}>
              {settings.biometricCredentialId
                ? 'Face ID opnieuw koppelen'
                : 'Face ID / Touch ID inschakelen'}
            </button>
          )}
          {settings.pinHash && (
            <button
              className="btn ghost"
              onClick={() =>
                onSettings({ ...settings, pinHash: undefined, biometricCredentialId: undefined })
              }
            >
              Slot verwijderen
            </button>
          )}
        </div>
      </Card>

      <Card title="Naar Claude">
        <p className="note" style={{ marginBottom: 12 }}>
          Stuur je data naar de Claude-app om vragen te stellen die verder gaan dan de vaste
          inzichten. Delen opent het iOS-deelvenster; kopiëren zet een compacte samenvatting op je
          klembord die je in een gesprek plakt.
        </p>
        <div className="row">
          <button className="btn" onClick={share}>
            Delen
          </button>
          <button className="btn secondary" onClick={copy}>
            Kopiëren
          </button>
        </div>
      </Card>

      <Vakantie onReload={onReload} />

      <Card title="Back-up">
        <p className="note" style={{ marginBottom: 12 }}>
          Je data staat alleen op dit toestel. Wis je je browseropslag, dan is die weg. Exporteer
          regelmatig — je PIN gaat niet mee in het bestand.
        </p>
        <div className="row">
          <button className="btn" onClick={download}>
            Exporteren ({days.length} {days.length === 1 ? 'dag' : 'dagen'})
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void upload(f)
              e.target.value = ''
            }}
          />
          <button className="btn secondary" onClick={() => fileRef.current?.click()}>
            Importeren
          </button>
        </div>
      </Card>

      {msg && <p className="note">{msg}</p>}
    </>
  )
}


/* ---------------- beheer van je itemlijst ---------------- */

/**
 * Beheer van je itemlijst. Twee dingen gaan hier bewust anders dan je zou
 * verwachten.
 *
 * Een naam wordt pas vastgelegd als je het veld verlaat, niet per toetsaanslag.
 * Hernoemen verandert namelijk ook de sleutel waarop de app het item herkent,
 * en tijdens het typen van 'Bier (blik 330 ml)' kom je langs 'Bier' — bestaat
 * dat al, dan zou de app de twee halverwege samenvoegen.
 *
 * En elke wijziging gaat naar de server. Deed hij dat niet, dan stond een item
 * dat je hier wiste bij de volgende synchronisatie gewoon weer in je lijst.
 */
function FoodsCard({ onChanged }: { onChanged: () => void }) {
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [filter, setFilter] = useState('')
  const [concept, setConcept] = useState<Record<string, string>>({})

  useEffect(() => {
    void allFoods().then(setFoods)
  }, [])

  const zoek = foodKey(filter)
  const zichtbaar = foods
    .filter((f) => f.key.includes(zoek) || foodKey(f.name).includes(zoek))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))

  const bewerk = (key: string, p: Partial<FoodItem>) => {
    const next = foods.map((f) => (f.key === key ? { ...f, ...p } : f))
    setFoods(next)
    const gewijzigd = next.find((f) => f.key === key)
    if (gewijzigd) void putFoods([gewijzigd])
  }

  const legNaamVast = async (key: string) => {
    const naam = concept[key]
    setConcept(({ [key]: _, ...rest }) => rest)
    if (naam == null) return
    const { items, weg } = hernoemItem(foods, key, naam)
    if (items === foods) return
    setFoods(items)
    await putFoods(items.filter((f) => !foods.includes(f)))
    for (const k of weg) await deleteFood(k)
    onChanged()
  }

  const wis = async (key: string) => {
    setFoods((prev) => prev.filter((f) => f.key !== key))
    await deleteFood(key)
    onChanged()
  }

  return (
    <Card title={`Mijn items (${foods.length})`}>
      <p className="note" style={{ marginBottom: 12 }}>
        Alles wat je met een naam en calorieën opslaat komt hier vanzelf in. De twee velden zijn
        calorieën en eiwit in gram; eiwit mag leeg blijven. Typefouten gooi je eruit met het kruisje.
        Geef je een item de naam van een item dat al bestaat, dan worden ze samengevoegd.
      </p>

      <div className="field">
        <label>Zoeken</label>
        <input
          type="text"
          value={filter}
          placeholder="Bijvoorbeeld: bolletje"
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="food-list">
        {zichtbaar.length === 0 && <p className="empty">Geen items gevonden.</p>}
        {zichtbaar.map((f) => (
          <div className="food-row" key={f.key}>
            <input
              className="food-name"
              value={concept[f.key] ?? f.name}
              onChange={(e) => setConcept((c) => ({ ...c, [f.key]: e.target.value }))}
              onBlur={() => void legNaamVast(f.key)}
            />
            <input
              className="food-kcal"
              type="text"
              inputMode="numeric"
              aria-label="calorieën"
              value={f.kcal}
              onChange={(e) => bewerk(f.key, { kcal: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              onBlur={onChanged}
            />
            <input
              className="food-protein"
              type="text"
              inputMode="numeric"
              aria-label="eiwit in gram"
              placeholder="g"
              value={f.proteinG ?? ''}
              onChange={(e) => {
                const cijfers = e.target.value.replace(/\D/g, '')
                bewerk(f.key, { proteinG: cijfers === '' ? undefined : Number(cijfers) })
              }}
              onBlur={onChanged}
            />
            <button
              className="remove"
              aria-label={`${f.name} verwijderen`}
              onClick={() => void wis(f.key)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </Card>
  )
}

/**
 * Een vakantie in één keer markeren. Los aanvinken werkt niet voor waar dit voor
 * bedoeld is: je zet de vlag juist voor dagen dat je de app niet opent, vaak nog
 * voordat je vertrekt. Reisdagen horen er gewoon bij — ook een reisdag is geen
 * gewone dag.
 *
 * Bestaande dagen worden bijgewerkt, niet overschreven: wat je die dag wel hebt
 * gelogd blijft staan.
 */
function Vakantie({ onReload }: { onReload: () => Promise<void> }) {
  const [van, setVan] = useState<string | undefined>(todayISO())
  const [tot, setTot] = useState<string | undefined>(undefined)
  const [bezig, setBezig] = useState(false)
  const [melding, setMelding] = useState('')

  const geldig = (d: string | undefined) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d))
  const kan = geldig(van) && geldig(tot) && van! <= tot!

  const markeer = async (aan: boolean) => {
    if (!kan) return
    setBezig(true)
    let n = 0
    for (let d = van!; d <= tot!; d = shiftISO(d, 1)) {
      const bestaand = (await getDay(d)) ?? emptyDay(d)
      const dag = normalizeDay(bestaand)
      await putDay({ ...dag, context: { ...dag.context, holiday: aan || undefined } })
      n++
      if (n > 400) break
    }
    await onReload()
    setBezig(false)
    setMelding(`${n} ${n === 1 ? 'dag' : 'dagen'} ${aan ? 'gemarkeerd als vakantie' : 'vrijgegeven'}.`)
  }

  return (
    <Card title="Vakantie">
      <p className="note" style={{ marginBottom: 12 }}>
        Markeer je reis vooraf, dan weet de app later waarom er geen wegingen zijn en hoe je de
        eerste weging bij thuiskomst moet lezen. Vakantiedagen tellen niet mee in hoe volledig je
        logt.
      </p>
      <div className="fields">
        <TextField label="Van" placeholder="2026-09-24" value={van} onChange={setVan} wide />
        <TextField label="Tot en met" placeholder="2026-10-03" value={tot} onChange={setTot} wide />
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn" disabled={!kan || bezig} onClick={() => void markeer(true)}>
          Markeren
        </button>
        <button className="btn secondary" disabled={!kan || bezig} onClick={() => void markeer(false)}>
          Weghalen
        </button>
      </div>
      {melding && <p className="note">{melding}</p>}
    </Card>
  )
}
