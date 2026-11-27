/**
 * Herkenning van een geplakte Fitdays-weging (Live Text, "Kopieer alles").
 *
 * Er is nog geen echte Live Text-tekst. Deze teksten zijn nagebouwd op de meting
 * van 27 november 2026 (07:21), in de twee volgordes die Live Text kan kiezen
 * voor een raster van drie kolommen: per kaartje en per rij, in het Engels en in
 * het Nederlands. Bovenaan staan steeds het grote gewicht, het deelmoment en het
 * meetmoment, die niet als waarde mogen tellen.
 *
 * Gebruik: npm run test-fitdays
 */
import { parseFitdays, type FitdaysVeld } from '../src/lib/fitdays'

let gezakt = 0
const eis = (wat: string, waar: boolean, extra?: unknown) => {
  console.log(`${waar ? 'ok  ' : 'FOUT'}  ${wat}`)
  if (!waar) {
    gezakt++
    if (extra !== undefined) console.log('      ', JSON.stringify(extra))
  }
}

const VERWACHT: Record<FitdaysVeld, number> = {
  weightKg: 76.15,
  bodyFatPct: 21.8,
  fatMassKg: 16.6,
  muscleMassKg: 57.0,
  boneMassKg: 2.6,
  proteinPct: 19.7,
  waterPct: 55.0,
  waterMassKg: 41.9,
  visceralFat: 9.5,
}

/** [Engels label, Nederlands label, Engelse waarde, status EN, status NL] */
const RASTER: [string, string, string, string, string][] = [
  ['Weight', 'Gewicht', '76.15kg', 'High', 'Hoog'],
  ['BMI', 'BMI', '25.2', 'High', 'Hoog'],
  ['Body Fat', 'Lichaamsvet', '21.8%', 'Standard', 'Standaard'],
  ['Fat Mass', 'Vetmassa', '16.6kg', 'Standard', 'Standaard'],
  ['Muscle Rate', 'Spiersnelheid', '74.8%', 'Excellent', 'Uitstekend'],
  ['Muscle Mass', 'Spiermassa', '57.0kg', 'Excellent', 'Uitstekend'],
  ['Skeletal Mus…', 'Skeletspier', '42.4%', 'Standard', 'Standaard'],
  ['Bone Mass', 'Botmassa', '2.6kg', 'Standard', 'Standaard'],
  ['Protein', 'Eiwit', '19.7%', 'Standard', 'Standaard'],
  ['Protein Mass', 'Eiwitmassa', '15.0kg', 'Standard', 'Standaard'],
  ['Body Water', 'Lichaamswater', '55.0%', 'Standard', 'Standaard'],
  ['Water Weight', 'Watergewicht', '41.9kg', 'Standard', 'Standaard'],
  ['Subcutaneous Fat', 'Onderhuids vet', '15.6%', 'Standard', 'Standaard'],
  ['Visceral Fat', 'Visceraal vet', '9.5', 'High', 'Hoog'],
  ['Body Age', 'Lichaamsleeftijd', '31', '', ''],
  ['BMR', 'BMR', '1691kcal', '', ''],
  ['Fat-free Bod…', 'Vetvrij lichaa…', '59.5kg', '', ''],
  ['Ideal Body W…', 'Ideaal lichaa…', '66.6kg', '', ''],
]

const HEADER_EN = ['Irving', 'Nov.27,2026 08:38', '76.15', 'kg', 'Measured 07:21']
const HEADER_NL = ['Irving', '27 nov. 2026 08:38', '76,15', 'kg', 'Gemeten 07:21']
const VOET_EN = ['Recommended target weight 69.6kg', 'Weight control -6.5kg', 'Fat control -5.2kg', 'Muscle control 0.0kg']
const VOET_NL = ['Aanbevolen doelgewicht 69,6kg', 'Gewichtscontrole -6,5kg', 'Vetcontrole -5,2kg', 'Spiercontrole 0,0kg']

/** Engels getal naar Nederlands, met af en toe een losse eenheid. */
const nlGetal = (w: string, i: number) => {
  const c = w.replace('.', ',')
  return i % 2 ? c.replace(/(kg|%|kcal)$/, ' $1') : c
}

function perKaartje(nl: boolean): string {
  const r: string[] = [...(nl ? HEADER_NL : HEADER_EN)]
  RASTER.forEach(([en, nlLabel, w, sEn, sNl], i) => {
    r.push(nl ? nlLabel : en, nl ? nlGetal(w, i) : w)
    const s = nl ? sNl : sEn
    if (s) r.push(s)
  })
  return [...r, ...(nl ? VOET_NL : VOET_EN)].join('\n')
}

function perRij(nl: boolean, opEenRegel = false): string {
  const r: string[] = [...(nl ? HEADER_NL : HEADER_EN)]
  for (let i = 0; i < RASTER.length; i += 3) {
    const rij = RASTER.slice(i, i + 3)
    const labels = rij.map(([en, nlLabel]) => (nl ? nlLabel : en))
    const waarden = rij.map(([, , w], j) => (nl ? nlGetal(w, i + j) : w))
    const statussen = rij.map(([, , , sEn, sNl]) => (nl ? sNl : sEn)).filter(Boolean)
    if (opEenRegel) {
      r.push(labels.join(' '), waarden.join(' '), statussen.join(' '))
    } else {
      r.push(...labels, ...waarden, ...statussen)
    }
  }
  return [...r, ...(nl ? VOET_NL : VOET_EN)].join('\n')
}

function controleer(naam: string, tekst: string) {
  const u = parseFitdays(tekst)
  const fout = (Object.keys(VERWACHT) as FitdaysVeld[]).filter((v) => u.waarden[v] !== VERWACHT[v])
  eis(`${naam}: alle negen velden goed`, fout.length === 0, { fout, waarden: u.waarden, u })
  eis(`${naam}: geen waarschuwingen`, u.waarschuwingen.length === 0, u.waarschuwingen)
  return u
}

controleer('Engels per kaartje', perKaartje(false))
controleer('Engels per rij', perRij(false))
controleer('Nederlands per kaartje', perKaartje(true))
controleer('Nederlands per rij', perRij(true))
controleer('Engels per rij, drie labels op één regel', perRij(false, true))
controleer('Nederlands per rij, drie labels op één regel', perRij(true, true))
controleer('Engels per kaartje, label en waarde op één regel', RASTER.map(([en, , w, s]) => `${en} ${w} ${s}`).join('\n'))

// Onbekende statuswoorden mogen de rij-koppeling niet verschuiven.
controleer(
  'per rij met onbekende statuswoorden',
  perRij(false).replace(/\nStandard/g, '\nNormaalwaarde').replace(/\nHigh/g, '\nAttention'),
)
// Een Fitdays-label dat niet in de lijst staat, mag zijn buren niet hun getal afpakken.
controleer(
  'per kaartje met een onbekend label',
  perKaartje(false).replace('Skeletal Mus…', 'Frobnicator Index'),
)
controleer(
  'per rij met een onbekend label',
  perRij(false).replace('Skeletal Mus…', 'Frobnicator Index'),
)

// --- Verwarrende labels komen niet in het verkeerde veld ---
const los = (t: string) => parseFitdays(t).waarden
eis('Protein Mass is geen eiwit%', los('Protein Mass\n15.0kg').proteinPct == null)
eis('Muscle Rate is geen spiermassa', los('Muscle Rate\n74.8%').muscleMassKg == null)
eis('Skeletal Muscle is geen spiermassa', los('Skeletal Muscle\n42.4%').muscleMassKg == null)
eis('Water Weight is geen gewicht', (() => {
  const w = los('Water Weight\n41.9kg')
  return w.weightKg == null && w.waterMassKg === 41.9
})())
eis('Fat-free Body Weight is geen gewicht en geen vet', (() => {
  const w = los('Fat-free Body Weight\n59.5kg')
  return w.weightKg == null && w.fatMassKg == null && w.bodyFatPct == null
})())
eis('afgekapt "Fat-free Bod…" ook niet', Object.keys(los('Fat-free Bod…\n59.5kg')).length === 0)
eis('Ideal Body Weight is geen gewicht', los('Ideal Body W…\n66.6kg').weightKg == null)
eis('Recommended target weight is geen gewicht', los('Recommended target weight 69.6kg').weightKg == null)
eis('Weight control is geen gewicht', los('Weight control\n-6.5kg').weightKg == null)
eis('Subcutaneous Fat is geen lichaamsvet', los('Subcutaneous Fat\n15.6%').bodyFatPct == null)
eis('Eiwitmassa is geen eiwit%', los('Eiwitmassa\n15,0 kg').proteinPct == null)
eis('Watergewicht is geen gewicht', los('Watergewicht\n41,9kg').weightKg == null)
eis('Vetvrij lichaamsgewicht is geen gewicht', los('Vetvrij lichaamsgewicht\n59,5kg').weightKg == null)
eis('Spiersnelheid is geen spiermassa', los('Spiersnelheid\n74,8%').muscleMassKg == null)

// --- Het deelmoment en meetmoment worden geen waarde ---
{
  const w = los('Nov.27,2026 08:38\n07:21\nVisceral Fat\n9.5\nBody Age\n31')
  eis('tijden en datum worden niet als waarde gepakt', w.visceralFat === 9.5)
}
{
  // per rij: waarden met status, het volgende getal direct op de regel eronder
  const w = los('Visceraal vet\nLichaamsleeftijd\nBMR\n9,5 Standaard\n1691 kcal\n31')
  eis('"9,5 Standaard 1691" blijft 9,5 (geen datum)', w.visceralFat === 9.5, w)
}

// --- Samenhang: een niet-passend paar wordt tegengehouden ---
{
  const t = perKaartje(false).replace('16.6kg', '19.6kg')
  const u = parseFitdays(t)
  eis('vetmassa die niet bij gewicht × vet% past, wordt niet ingevuld', u.waarden.fatMassKg == null && u.waarden.bodyFatPct == null)
  eis('en geeft een waarschuwing', u.waarschuwingen.some((w) => w.includes('Vetmassa')))
  eis('de rest wordt wel ingevuld', u.waarden.weightKg === 76.15 && u.waarden.waterMassKg === 41.9)
  eis('tegengehouden waarden blijven beschikbaar', u.tegengehouden.some((x) => x.veld === 'fatMassKg' && x.waarde === 19.6))
}
{
  const u = parseFitdays(perKaartje(false).replace(/76\.15/g, '86.15'))
  eis('klopt geen van beide paren, dan wordt ook het gewicht tegengehouden', u.waarden.weightKg == null)
}
{
  const u = parseFitdays('Bone Mass\n12.6kg')
  eis('botmassa buiten 1–6 kg wordt niet ingevuld', u.waarden.boneMassKg == null && u.waarschuwingen.length === 1)
}
{
  const u = parseFitdays('Weight\n76.15kg\nBody Fat\n21.8%')
  eis('alleen wat er staat; de rest heet niet gevonden', u.nietGevonden.length === 7 && !('fatMassKg' in u.waarden))
}
eis('willekeurige tekst levert niets op', Object.keys(parseFitdays('Hallo, dit is geen weging 12 34').waarden).length === 0)

console.log(gezakt ? `\n${gezakt} test(s) gezakt` : '\nalles ok')
process.exit(gezakt ? 1 : 0)
