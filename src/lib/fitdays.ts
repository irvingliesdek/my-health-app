/**
 * Herkent een Fitdays-weging in tekst die met Live Text van iOS uit een
 * screenshot is gekopieerd ("Kopieer alles").
 *
 * De volgorde van die tekst is niet te voorspellen. Fitdays toont de waarden in
 * een raster van drie kolommen, en Live Text leest dat soms per kaartje (label,
 * waarde, status, label, waarde, status) en soms per rij (drie labels, dan drie
 * waarden). Daarom:
 *
 * 1. De tekst wordt een rij tokens: labels (bekend veld, bekend-maar-genegeerd,
 *    of onbekend), getallen met hun eenheid, en statuswoorden (die vallen weg).
 * 2. Labels gaan in een wachtrij. Een getal gaat naar het oudste wachtende label
 *    waarvan de eenheid past. Per kaartje staat er steeds één label in de rij,
 *    per rij staan er drie, en in beide gevallen klopt de koppeling.
 * 3. Genegeerde labels (BMI, Muscle Rate, Protein Mass ...) doen gewoon mee in
 *    de wachtrij, zodat ze hun eigen getal opslokken en niet dat van een buur.
 * 4. Elke waarde moet binnen een plausibel bereik vallen, en vetmassa en
 *    watergewicht moeten passen bij gewicht × percentage. Klopt een paar niet,
 *    dan worden die velden niet ingevuld maar als waarschuwing teruggegeven.
 *
 * Alles vóór het eerste bekende label wordt overgeslagen: daar staan de grote
 * gewichtsweergave, de naam, het deelmoment en het meetmoment.
 */
import type { Body } from '../types'

export type FitdaysVeld =
  | 'weightKg'
  | 'bodyFatPct'
  | 'fatMassKg'
  | 'muscleMassKg'
  | 'boneMassKg'
  | 'proteinPct'
  | 'waterPct'
  | 'waterMassKg'
  | 'visceralFat'

type Eenheid = 'kg' | '%' | 'kcal' | 'geen'

type LabelDef = { veld: FitdaysVeld | null; eenheid: Eenheid; namen: string[] }

/** In de volgorde waarin de velden op het scherm staan. */
export const FITDAYS_VELDEN: { veld: FitdaysVeld; naam: string; eenheid: Eenheid; min: number; max: number }[] = [
  { veld: 'weightKg', naam: 'Gewicht', eenheid: 'kg', min: 30, max: 250 },
  { veld: 'bodyFatPct', naam: 'Lichaamsvet', eenheid: '%', min: 1, max: 80 },
  { veld: 'fatMassKg', naam: 'Vetmassa', eenheid: 'kg', min: 0.5, max: 200 },
  { veld: 'muscleMassKg', naam: 'Spiermassa', eenheid: 'kg', min: 10, max: 200 },
  { veld: 'boneMassKg', naam: 'Botmassa', eenheid: 'kg', min: 1, max: 6 },
  { veld: 'proteinPct', naam: 'Eiwit', eenheid: '%', min: 1, max: 80 },
  { veld: 'waterMassKg', naam: 'Watergewicht', eenheid: 'kg', min: 5, max: 200 },
  { veld: 'waterPct', naam: 'Lichaamswater', eenheid: '%', min: 1, max: 80 },
  { veld: 'visceralFat', naam: 'Visceraal vet', eenheid: 'geen', min: 1, max: 30 },
]

const LABELS: LabelDef[] = [
  { veld: 'weightKg', eenheid: 'kg', namen: ['weight', 'gewicht'] },
  { veld: 'bodyFatPct', eenheid: '%', namen: ['body fat', 'body fat rate', 'lichaamsvet', 'lichaamsvetpercentage', 'vetpercentage'] },
  { veld: 'fatMassKg', eenheid: 'kg', namen: ['fat mass', 'vetmassa'] },
  { veld: 'muscleMassKg', eenheid: 'kg', namen: ['muscle mass', 'spiermassa'] },
  { veld: 'boneMassKg', eenheid: 'kg', namen: ['bone mass', 'botmassa'] },
  { veld: 'proteinPct', eenheid: '%', namen: ['protein', 'eiwit'] },
  { veld: 'waterPct', eenheid: '%', namen: ['body water', 'lichaamswater'] },
  { veld: 'waterMassKg', eenheid: 'kg', namen: ['water weight', 'watergewicht'] },
  { veld: 'visceralFat', eenheid: 'geen', namen: ['visceral fat', 'visceraal vet', 'visceraalvet', 'visceral fat index'] },

  // Bekend maar genegeerd. Ze moeten wel herkend worden, anders pakt een buur hun getal.
  { veld: null, eenheid: 'geen', namen: ['bmi'] },
  { veld: null, eenheid: '%', namen: ['muscle rate', 'spiersnelheid', 'spierpercentage'] },
  { veld: null, eenheid: '%', namen: ['skeletal muscle', 'skeletal muscle rate', 'skeletspier', 'skeletspiermassa', 'skeletspierpercentage'] },
  { veld: null, eenheid: 'kg', namen: ['protein mass', 'eiwitmassa'] },
  { veld: null, eenheid: '%', namen: ['subcutaneous fat', 'onderhuids vet', 'onderhuidsvet'] },
  { veld: null, eenheid: 'kcal', namen: ['bmr', 'basal metabolic rate', 'basaal metabolisme', 'basaalmetabolisme', 'ruststofwisseling'] },
  { veld: null, eenheid: 'geen', namen: ['body age', 'lichaamsleeftijd', 'metabolic age'] },
  { veld: null, eenheid: 'kg', namen: ['fat free body weight', 'fat free mass', 'vetvrij lichaamsgewicht', 'vetvrije massa', 'vetvrij gewicht'] },
  { veld: null, eenheid: 'kg', namen: ['ideal body weight', 'ideaal lichaamsgewicht', 'ideaal gewicht'] },
  { veld: null, eenheid: 'kg', namen: ['recommended target weight', 'aanbevolen doelgewicht', 'aanbevolen streefgewicht', 'doelgewicht', 'streefgewicht'] },
  { veld: null, eenheid: 'kg', namen: ['weight control', 'gewichtscontrole', 'gewichtsbeheersing', 'gewichtsregulatie'] },
  { veld: null, eenheid: 'kg', namen: ['fat control', 'vetcontrole', 'vetbeheersing', 'vetregulatie'] },
  { veld: null, eenheid: 'kg', namen: ['muscle control', 'spiercontrole', 'spierbeheersing', 'spierregulatie'] },
]

/** Woorden die een beoordeling zijn en geen label. */
const STATUS = new Set([
  'standard', 'normal', 'high', 'low', 'excellent', 'good', 'great', 'insufficient', 'slightly',
  'very', 'too', 'over', 'under', 'overweight', 'underweight', 'obese', 'thin', 'healthy', 'fine',
  'standaard', 'normaal', 'hoog', 'laag', 'uitstekend', 'goed', 'onvoldoende', 'licht', 'iets',
  'zeer', 'erg', 'te', 'overgewicht', 'ondergewicht', 'obesitas', 'mager', 'gezond', 'prima',
])

type Woord = { w: string; afgekapt: boolean }
type Token =
  | { t: 'label'; def: LabelDef | null; tekst: string }
  | { t: 'getal'; waarde: number; eenheid: Eenheid | null }

const normaal = (s: string) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const MAAND = '(?:jan|feb|mar|maa|apr|may|mei|jun|jul|aug|sep|oct|okt|nov|dec)[a-z]*'

/**
 * Tijden en datums weg, die zijn nooit een waarde. Alleen met echte maandnamen:
 * een losser patroon at in "9,5 Standaard 1691" de 5 van visceraal vet op.
 */
function zonderTijden(s: string): string {
  return s
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/gi, ' ')
    .replace(new RegExp(`\\b${MAAND}\\.?\\s*\\d{1,2}(st|nd|rd|th)?\\s*,?\\s*\\d{4}\\b`, 'gi'), ' ') // Nov.27,2026
    .replace(new RegExp(`\\b\\d{1,2}\\.?\\s*${MAAND}\\.?\\s*,?\\s*\\d{4}\\b`, 'gi'), ' ') // 27 nov. 2026
    .replace(/\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ' ')
}

const GETAL = /([-+−]?\d+(?:[.,]\d+)?)\s*(kg|%|kcal|cal|jaar|years?|yrs?|lbs?|st)?(?![a-z])/gi

function eenheidVan(u: string | undefined): Eenheid | null | 'vreemd' {
  if (!u) return null
  const x = u.toLowerCase()
  if (x === 'kg') return 'kg'
  if (x === '%') return '%'
  if (x === 'kcal' || x === 'cal') return 'kcal'
  if (/^(jaar|years?|yrs?)$/.test(x)) return 'geen'
  return 'vreemd' // pond of stone: niet omrekenen, gewoon niet herkennen
}

function woorden(tekst: string): Woord[] {
  const uit: Woord[] = []
  const schoon = normaal(tekst)
    .replace(/\(.*?\)/g, ' ')
    .replace(/[-–—_/]/g, ' ')
    .replace(/…|\.{2,}/g, '… ')
  for (const ruw of schoon.split(/\s+/)) {
    if (!ruw) continue
    const afgekapt = ruw.includes('…')
    const w = ruw.replace(/[^\p{L}\p{N}]/gu, '')
    if (w) uit.push({ w, afgekapt })
    else if (afgekapt && uit.length) uit[uit.length - 1].afgekapt = true
  }
  return uit
}

type Kandidaat = { def: LabelDef; woorden: string[] }
const KANDIDATEN: Kandidaat[] = LABELS.flatMap((def) => def.namen.map((n) => ({ def, woorden: n.split(' ') })))

/**
 * Hoeveel woorden vanaf positie i bij deze naam horen. Het laatste woord mag
 * afgekapt zijn ("Skeletal Mus…"), dan telt het als begin van het labelwoord.
 */
function past(ws: Woord[], i: number, k: Kandidaat): number {
  for (let j = 0; j < k.woorden.length; j++) {
    const w = ws[i + j]
    if (!w) return 0
    if (w.w === k.woorden[j]) {
      if (w.afgekapt) return j + 1 // afgekapt na een heel woord
      continue
    }
    if (w.afgekapt && k.woorden[j].startsWith(w.w)) return j + 1
    return 0
  }
  return k.woorden.length
}

/** Verdeelt een stuk tekst in labels; statuswoorden vallen weg. */
function labels(tekst: string): Token[] {
  const ws = woorden(tekst)
  const uit: Token[] = []
  let onbekend: string[] = []
  const sluitOnbekend = () => {
    if (onbekend.length) uit.push({ t: 'label', def: null, tekst: onbekend.join(' ') })
    onbekend = []
  }
  let i = 0
  while (i < ws.length) {
    // Langste volledige naam wint: "water weight" gaat voor "weight".
    let beste: { n: number; defs: Set<LabelDef>; volledig: boolean } | null = null
    for (const k of KANDIDATEN) {
      const n = past(ws, i, k)
      if (!n) continue
      const volledig = n === k.woorden.length && !ws[i + n - 1].afgekapt
      if (
        !beste ||
        n > beste.n ||
        (n === beste.n && volledig && !beste.volledig)
      ) {
        beste = { n, defs: new Set([k.def]), volledig }
      } else if (n === beste.n && volledig === beste.volledig) {
        beste.defs.add(k.def)
      }
    }
    if (beste) {
      sluitOnbekend()
      // Afgekapt en dubbelzinnig ("Body…"): wel een label, maar geen veld.
      const def = beste.defs.size === 1 ? [...beste.defs][0] : null
      uit.push({ t: 'label', def, tekst: ws.slice(i, i + beste.n).map((w) => w.w).join(' ') })
      i += beste.n
      continue
    }
    if (STATUS.has(ws[i].w)) {
      sluitOnbekend()
      i++
      continue
    }
    if (/^\p{L}/u.test(ws[i].w)) onbekend.push(ws[i].w)
    i++
  }
  sluitOnbekend()
  return uit
}

function tokens(tekst: string): Token[] {
  const uit: Token[] = []
  for (const regel of zonderTijden(tekst).split(/\r?\n/)) {
    let vanaf = 0
    for (const m of regel.matchAll(GETAL)) {
      uit.push(...labels(regel.slice(vanaf, m.index)))
      vanaf = m.index! + m[0].length
      const e = eenheidVan(m[2])
      if (e === 'vreemd') continue
      uit.push({ t: 'getal', waarde: Number(m[1].replace('−', '-').replace(',', '.')), eenheid: e })
    }
    const rest = regel.slice(vanaf)
    // Een eenheid op een eigen regel ("76.15" en dan "kg") hoort bij het getal ervoor.
    const losseEenheid = rest.trim().toLowerCase()
    const vorige = uit[uit.length - 1]
    if (vorige?.t === 'getal' && vorige.eenheid == null && /^(kg|%|kcal)$/.test(losseEenheid)) {
      vorige.eenheid = eenheidVan(losseEenheid) as Eenheid
      continue
    }
    uit.push(...labels(rest))
  }
  return uit
}

const pastEenheid = (label: Eenheid | null, getal: Eenheid | null) =>
  label == null || getal == null || label === getal

export type FitdaysUitslag = {
  /** wat veilig ingevuld kan worden */
  waarden: Partial<Pick<Body, FitdaysVeld>>
  /** herkend, maar tegengehouden omdat het niet klopt; met de reden */
  tegengehouden: { veld: FitdaysVeld; waarde: number; reden: string }[]
  /** velden die er niet in stonden of niet te koppelen waren */
  nietGevonden: FitdaysVeld[]
  waarschuwingen: string[]
}

export const veldNaam = (v: FitdaysVeld) => FITDAYS_VELDEN.find((f) => f.veld === v)!.naam
const nl1 = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',')

/** Hoeveel een gemeten massa mag afwijken van gewicht × percentage. */
export const SAMENHANG_MARGE = 0.03

type Koppeling = { gevonden: Map<FitdaysVeld, number[]>; wrijving: number }

/**
 * Koppelt getallen aan labels via de wachtrij. Met `metOnbekend` telt onbekende
 * tekst als label (een Fitdays-label dat hier niet in de lijst staat), zonder
 * telt hij als ruis (een statuswoord dat hier niet in de lijst staat). Welke van
 * de twee het is, valt vooraf niet te zeggen; de koppeling met de minste
 * wrijving (labels zonder getal, getallen zonder label) wint.
 */
function koppel(ts: Token[], metOnbekend: boolean): Koppeling {
  const wachtrij: (LabelDef | null)[] = []
  const gevonden = new Map<FitdaysVeld, number[]>()
  let wrijving = 0
  for (const t of ts) {
    if (t.t === 'label') {
      if (t.def || metOnbekend) wachtrij.push(t.def)
      continue
    }
    // Oudste wachtende label met een passende eenheid; de labels ervóór kregen
    // kennelijk geen getal en vallen af.
    const i = wachtrij.findIndex((d) => pastEenheid(d?.eenheid ?? null, t.eenheid))
    if (i < 0) {
      wrijving++
      continue
    }
    wrijving += i
    const def = wachtrij[i]
    wachtrij.splice(0, i + 1)
    if (!def?.veld) continue
    if (def.eenheid === 'geen' && t.eenheid != null) continue
    const lijst = gevonden.get(def.veld) ?? []
    lijst.push(t.waarde)
    gevonden.set(def.veld, lijst)
  }
  return { gevonden, wrijving: wrijving + wachtrij.length }
}

export function parseFitdays(tekst: string): FitdaysUitslag {
  const ts = tokens(tekst)
  const begin = ts.findIndex((t) => t.t === 'label' && t.def != null)
  const vanaf = begin < 0 ? [] : ts.slice(begin)
  const zonder = koppel(vanaf, false)
  const met = koppel(vanaf, true)
  const { gevonden } = met.wrijving < zonder.wrijving ? met : zonder

  const waarden: FitdaysUitslag['waarden'] = {}
  const tegengehouden: FitdaysUitslag['tegengehouden'] = []
  const waarschuwingen: string[] = []

  for (const f of FITDAYS_VELDEN) {
    const lijst = gevonden.get(f.veld)
    if (!lijst) continue
    const verschillend = [...new Set(lijst)]
    if (verschillend.length > 1) {
      // Gewicht staat bovenaan en in het raster; als die verschillen is er iets mis.
      waarschuwingen.push(`${f.naam}: twee verschillende waarden gevonden (${verschillend.map(nl1).join(' en ')}).`)
      tegengehouden.push({ veld: f.veld, waarde: verschillend[verschillend.length - 1], reden: 'twee waarden' })
      continue
    }
    const v = verschillend[0]
    if (v < f.min || v > f.max) {
      waarschuwingen.push(`${f.naam} ${nl1(v)} valt buiten ${f.min}–${f.max}, niet ingevuld.`)
      tegengehouden.push({ veld: f.veld, waarde: v, reden: 'buiten bereik' })
      continue
    }
    waarden[f.veld] = v
  }

  // Samenhang: massa ≈ gewicht × percentage / 100.
  const paren: [FitdaysVeld, FitdaysVeld, string][] = [
    ['fatMassKg', 'bodyFatPct', 'Vetmassa'],
    ['waterMassKg', 'waterPct', 'Watergewicht'],
  ]
  const gewicht = waarden.weightKg
  const fout: [FitdaysVeld, FitdaysVeld][] = []
  if (gewicht != null) {
    for (const [massa, pct, naam] of paren) {
      const m = waarden[massa]
      const p = waarden[pct]
      if (m == null || p == null) continue
      const verwacht = (gewicht * p) / 100
      if (Math.abs(m - verwacht) > SAMENHANG_MARGE * verwacht) {
        waarschuwingen.push(
          `${naam} ${nl1(m)} kg past niet bij ${nl1(gewicht)} kg × ${nl1(p)}% = ${nl1(verwacht)} kg. ` +
            'Deze twee zijn niet ingevuld; controleer ze.',
        )
        fout.push([massa, pct])
      }
    }
  }
  // Kloppen beide paren niet, dan is het gewicht zelf de verdachte.
  const verdacht = new Set(fout.flat())
  if (fout.length === 2) verdacht.add('weightKg')
  for (const v of verdacht) {
    tegengehouden.push({ veld: v, waarde: waarden[v]!, reden: 'past niet bij de rest' })
    delete waarden[v]
  }

  const nietGevonden = FITDAYS_VELDEN.map((f) => f.veld).filter(
    (v) => waarden[v] == null && !tegengehouden.some((t) => t.veld === v),
  )
  return { waarden, tegengehouden, nietGevonden, waarschuwingen }
}
