/**
 * Bootst na wat er in de schermopname gebeurde: je typt 1881, het veld toont
 * 1881, en een halve seconde later staat er weer 188.
 *
 * De oorzaak zat niet in het invoerveld maar in de sync. Die leest de opslag,
 * rekent, en levert daarna een lijst dagen aan die op het scherm werd gezet --
 * vervangend. Typte je in die tussentijd nog een cijfer, dan werd dat
 * weggegooid. Nu wordt er samengevoegd en wint per dag de nieuwste versie.
 *
 * Gebruik: npm run test-race
 */
import { applyRemoteDays, mergeDays } from '../src/lib/sync'
import { emptyDay, type DayEntry } from '../src/types'

let gezakt = 0
const eis = (wat: string, waar: boolean) => {
  console.log(`${waar ? 'ok  ' : 'FOUT'}  ${wat}`)
  if (!waar) gezakt++
}

const datum = '2026-10-06'
const dagMet = (n: number, updatedAt: number): DayEntry => ({
  ...emptyDay(datum),
  restingKcal: n,
  updatedAt,
})

// De sync vertrok toen er 188 stond; jij typte intussen de laatste 1.
const opHetScherm = [dagMet(1881, 2_000)]
const vanDeSync = [dagMet(188, 1_000)]

const na = applyRemoteDays(opHetScherm, vanDeSync)
eis('je laatste toetsaanslag overleeft een trage sync', na[0].restingKcal === 1881)

// Ter controle het oude gedrag: vervangen in plaats van samenvoegen.
eis('en zou dat met het oude, vervangende gedrag niet hebben gedaan',
    vanDeSync[0].restingKcal === 188)

// Een echt nieuwere versie van je andere toestel moet wel winnen.
const vanElders = [dagMet(2000, 9_000)]
eis('een nieuwere versie van elders wint wel',
    applyRemoteDays(opHetScherm, vanElders)[0].restingKcal === 2000)

// Een gewiste dag blijft weg.
const grafsteen: DayEntry = { ...emptyDay(datum), deleted: true, updatedAt: 9_999 }
eis('een dag die je elders wiste komt niet terug',
    applyRemoteDays(opHetScherm, [grafsteen]).length === 0)

// En de merge zelf laat de nieuwste winnen, ongeacht de volgorde.
eis('volgorde maakt niet uit', mergeDays(vanDeSync, opHetScherm)[0].restingKcal === 1881)

console.log(gezakt === 0 ? '\nAlles goed.' : `\n${gezakt} controle(s) gezakt.`)
process.exit(gezakt === 0 ? 0 : 1)
