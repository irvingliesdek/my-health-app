/**
 * Bootst na hoe 'Glas rode wijn' twee keer in de itemlijst kwam.
 *
 * Hernoemen veranderde vroeger alleen de naam en liet de sleutel staan. Een
 * item dat 'Rode wijn' heette en werd omgedoopt tot 'Glas rode wijn (150 ml)'
 * hield de sleutel 'rode wijn'. Kies je het daarna en sla je de dag op, dan
 * leert de app het item onder zijn nieuwe naam — een tweede sleutel, een
 * tweede regel met precies dezelfde naam.
 *
 * Gebruik: npm run test-items
 */
import 'fake-indexeddb/auto'
import { allFoods, herstelItemlijst, putFoods } from '../src/lib/db'
import { foodKey, hernoemItem, herstelSleutels, learnFromDay, type FoodItem } from '../src/lib/foods'
import { emptyDay } from '../src/types'

let gezakt = 0
const eis = (wat: string, waar: boolean) => {
  console.log(`${waar ? 'ok  ' : 'FOUT'}  ${wat}`)
  if (!waar) gezakt++
}
const item = (name: string, kcal: number, uses: number, lastUsed: number, key = foodKey(name)): FoodItem =>
  ({ key, name, kcal, uses, lastUsed })

// 1. Het oude scenario: hernoemd item met oude sleutel, daarna gekozen en opgeslagen.
const hernoemdOud = item('Glas rode wijn (150 ml)', 150, 30, 1_000, 'rode wijn')
const dag = emptyDay('2026-10-12')
dag.meals = [{ id: 'm', name: 'Glas rode wijn (150 ml)', kcal: 150 }]
const nalearn = learnFromDay(dag, [hernoemdOud])
const wijnen = nalearn.filter((f) => f.name === 'Glas rode wijn (150 ml)')
eis('het oude gedrag levert inderdaad twee regels met dezelfde naam op', wijnen.length === 2)

// 2. Het herstel ruimt dat op.
const { items, weg } = herstelSleutels(nalearn)
const naHerstel = items.filter((f) => f.name === 'Glas rode wijn (150 ml)')
eis('na herstel staat hij er nog maar één keer in', naHerstel.length === 1)
eis('het gebruik is opgeteld en niet weggegooid', naHerstel[0].uses === 31)
eis('de oude sleutel wordt opgeruimd', weg.includes('rode wijn'))

// 3. Hernoemen naar een naam die al bestaat voegt samen in plaats van dubbel.
const lijst = [item('Bier (blik 330 ml)', 139, 10, 2_000), item('Blikje bier', 140, 4, 1_000)]
const hn = hernoemItem(lijst, foodKey('Blikje bier'), 'Bier (blik 330 ml)')
eis('hernoemen naar een bestaande naam voegt samen', hn.items.length === 1 && hn.items[0].uses === 14)

// 4. Twee keer 'Stëlz' die er hetzelfde uitzien maar anders gecodeerd zijn.
const samengesteld = 'Stëlz hard iced tea'   // e + los trema
const enkel = 'Stëllz'.replace('ll', 'l') + ' hard iced tea' // één teken ë
eis('Unicode-varianten van dezelfde naam krijgen dezelfde sleutel', foodKey(samengesteld) === foodKey(enkel))

// 5. Echt verschillende porties blijven gescheiden.
const porties = herstelSleutels([item('Glas rode wijn (150 ml)', 150, 5, 1), item('Glas rode wijn (200 ml)', 200, 3, 2)])
eis('150 ml en 200 ml blijven twee items', porties.items.length === 2)

// 6. Het herstel bij het opstarten, op een echte (geheugen-)database.
await putFoods(nalearn)
const voor = (await allFoods()).filter((f) => f.name === 'Glas rode wijn (150 ml)').length
const veranderd = await herstelItemlijst()
const na = (await allFoods()).filter((f) => f.name === 'Glas rode wijn (150 ml)').length
eis(`opstartherstel: van ${voor} naar ${na} regels`, veranderd && voor === 2 && na === 1)
eis('en een tweede keer draaien verandert niets meer', (await herstelItemlijst()) === false)

console.log(gezakt === 0 ? '\nAlles goed.' : `\n${gezakt} controle(s) gezakt.`)
process.exit(gezakt === 0 ? 0 : 1)
