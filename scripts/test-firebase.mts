/**
 * Controleert dat een dag met eten erin door de validatie van Firebase komt.
 *
 * Firebase weigert een hele schrijfactie zodra er ergens een veld op
 * `undefined` staat. Maaltijden hebben die vaak: geen tijdstip, geen eiwit.
 * Daardoor bereikte maandenlang geen enkele dag met eten de server, terwijl
 * dagen met alleen een weging er wel kwamen.
 *
 * Gebruikt de echte Firebase-bibliotheek. Die valideert lokaal voordat er iets
 * het netwerk op gaat, dus deze test heeft geen verbinding of account nodig.
 *
 * Gebruik: npm run test-firebase
 */
import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set } from 'firebase/database'
import { zonderUndefined } from '../src/lib/firebase'
import { emptyDay, type DayEntry } from '../src/types'

const db = getDatabase(initializeApp({ databaseURL: 'https://test-default-rtdb.europe-west1.firebasedatabase.app' }))
let gezakt = 0
const eis = (wat: string, waar: boolean) => {
  console.log(`${waar ? 'ok  ' : 'FOUT'}  ${wat}`)
  if (!waar) gezakt++
}
const komtDoor = (waarde: unknown) => {
  try {
    set(ref(db, 'test/dag'), waarde).catch(() => {})
    return true
  } catch {
    return false
  }
}

const dag: DayEntry = {
  ...emptyDay('2026-11-20'),
  body: { weightKg: 77.1, bodyFatPct: undefined },
  meals: [
    { id: 'a', name: 'Tosti (2 sneetjes)', kcal: 300, time: undefined, proteinG: undefined },
    { id: 'b', name: 'Glas rode wijn (150 ml)', kcal: 150, qty: undefined, time: '20:00' },
  ],
  context: { alcohol: true, holiday: undefined },
}

eis('zonder opschonen weigert Firebase de dag (het oude gedrag)', !komtDoor(dag))
eis('na opschonen komt de dag door', komtDoor(zonderUndefined(dag)))

const schoon = zonderUndefined(dag)
eis('de maaltijden blijven allebei bewaard', schoon.meals.length === 2)
eis('ingevulde waarden blijven staan', schoon.meals[1].time === '20:00' && schoon.body.weightKg === 77.1)
eis('lege velden zijn weg, niet op null gezet', !('time' in schoon.meals[0]) && !('holiday' in schoon.context))

console.log(gezakt === 0 ? '\nAlles goed.' : `\n${gezakt} controle(s) gezakt.`)
process.exit(gezakt === 0 ? 0 : 1)
