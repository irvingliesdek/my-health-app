# Mijn gezondheid

Persoonlijke gezondheidsapp van Irving: gewicht en lichaamssamenstelling (overgetypt
van een Fitdays-weegschaal), eten en drinken, verbranding, slaap, water, training en
context. React + Vite + TypeScript, als PWA op GitHub Pages.

- Live: https://irvingliesdek.github.io/my-health-app/
- Repo: irvingliesdek/my-health-app (verhuisd van irving-daylee; dat oude adres bestaat niet meer)
- Firebase-project: `my-health-app-9243f` (Realtime Database + Auth)

Hij werkt vanaf zijn iPhone. Schrijf alles in het Nederlands: code-commentaar,
commitberichten en antwoorden.

## Werkafspraken

- **Begin altijd met** `git fetch origin main && git checkout -B main origin/main`.
  Een container start soms op een oude `claude/...`-branch met een versie van maanden
  terug. Controleer ook dat `git remote get-url origin` naar `irvingliesdek` wijst.
- **Werk op `main` en deploy direct na elke wijziging, zonder te vragen.** Een push
  naar `main` start `.github/workflows/deploy.yml`. Controleer daarna in de Actions of
  de run slaagt en meld dat.
- **Hoog bij elke functionele wijziging de versie in `package.json` op** (patch voor
  een bugfix, minor voor iets nieuws). Dat nummer staat bovenin het scherm en vormt
  ook de cachenaam van de service worker. Zonder ophoging kan Irving niet zien of hij
  de nieuwe versie heeft.
- **Voor elke commit:** `npx tsc --noEmit`, `npm run build`, `npm run test-import`,
  `npm run test-race`, `npm run test-items`, `npm run test-firebase`. De deploy-workflow
  draait alleen `npm ci` en `npm run build`, dus de tests vangen niets af als je ze
  niet zelf draait.
- **Een bugfix krijgt een test die faalt op het oude gedrag.** Draai hem echt tegen de
  oude code. Een test die met en zonder fix slaagt, bewijst niets, en dat is hier
  twee keer gebeurd.
- **Commitberichten leggen uit waarom**, inclusief wat er misging als je onderweg een
  fout vond, ook je eigen fouten.
- Zeg het als iets niet klopt of niet kan, in plaats van een getal te verzinnen. Hij
  wil cijfers die kloppen, geen aanmoediging.

## Als hij een screenshot stuurt

Dat is de gewone manier van werken: een screenshot vanaf zijn telefoon, met een paar
woorden of zonder.

1. Zoek uit welk scherm het is. De tabbalk heeft Dag, Trends, Inzichten en
   Instellingen. Op Dag staat bovenin "Vandaag" of de weekdag. Het versienummer staat
   bovenin naast de titel. Staat daar een oudere versie dan `package.json`, dan draait
   zijn telefoon op een oude cache. Dan is de oplossing "app afsluiten en opnieuw
   openen", geen codewijziging.
2. Lees wat er staat en wat er niet klopt. Zonder uitleg: kijk naar tekst die buiten
   beeld loopt, getallen die niet kunnen kloppen, lege kaarten en verkeerde afronding.
   Weet je het niet zeker, vraag dan wat hij bedoelt voordat je bouwt.
3. Zoek de oorzaak, niet alleen het symptoom. Het laatste cijfer van een getal dat
   wegviel bleek bijvoorbeeld een race in de sync, geen fout in het invoerveld.
4. Repareer, test, deploy, controleer de run.
5. Sluit af met: wat er mis was, wat je hebt veranderd, welke versie live staat, en
   "sluit de app helemaal af en open hem opnieuw".

## Structuur

- `src/types.ts`: datamodel (`DayEntry`, `Body`, `Meal`, `Context`, `Profile`). Alles
  van buiten gaat door `normalizeDay`.
- `src/lib/db.ts`: IndexedDB (dagen, meta, itemlijst), import en export.
- `src/lib/firebase.ts`: alle schrijfacties naar Firebase, via `zonderUndefined`.
- `src/lib/useCloudSync.ts` en `src/lib/sync.ts`: synchronisatie en samenvoegen.
- `src/lib/derive.ts`: afgeleide waarden en datums, `weighIns`, `logPeriode`,
  `wekenSpan`, `voetbalDag`, `naVoetbalDag`, `vakantieBlokken`.
- `src/lib/insights.ts`: alle inzichten. `src/lib/predict.ts`: weegvoorspelling,
  `learnEffects`, `backtest`.
- `src/lib/foods.ts`: itemlijst (`foodKey`, `herstelSleutels`, `hernoemItem`).
- `src/sw-template.js`: service worker. `vite.config.ts` stempelt bij elke build de
  versie uit `package.json` erin (`__APP_VERSION__`), ook in de versiebadge bovenin.
- `scripts/test-*.mts`: de tests, op een IndexedDB in het geheugen (`fake-indexeddb`).
  `test-firebase` gebruikt de echte Firebase-bibliotheek, die lokaal valideert; er is
  geen netwerk of account voor nodig.
- `tools/redding/index.html`: reddingspagina die lokale data van een oud adres
  uitleest. Gebruikt bij de verhuizing.

## Valkuilen waar we al in zijn gevallen

- **Firebase weigert een hele `set()` als er ergens `undefined` in staat.** Maaltijden
  hebben dat vaak (geen tijd, geen eiwit). Daardoor kwam maandenlang geen enkele dag
  met eten op de server. Schrijf altijd via de push-functies in `firebase.ts`, nooit
  rechtstreeks met `set()`.
- **Sync vervangt de schermstand niet, maar voegt samen** (`applyRemoteDays`). Per dag
  wint de nieuwste `updatedAt`. Vervangen gooide de laatste toetsaanslag weg.
- **Lokale opslag hoort bij het adres.** Verhuist de site, dan begint de app daar leeg,
  en wat niet op de server stond is alleen nog via het oude adres te bereiken.
- **De service worker bewaart alleen een geslaagd antwoord als app.** Eerder werd een
  404 opgeslagen, en daarna opende de app nergens meer.
- **Itemlijst:** de sleutel is `foodKey(name)` (met Unicode-normalisatie). Hernoemen
  past de sleutel aan en voegt samen. Wijzigingen bij Mijn items gaan naar de server,
  anders komen gewiste items terug.
- **Alleen nuchtere ochtendwegingen tellen mee in trends** (`weighIns`). Een weging
  telt als nuchter tenzij `body.fasted` expliciet `false` is.
- **Vandaag is een halve dag**, en hoort niet als volle dag in een gemiddelde.
- **Deel niet door alle dagen in de app.** Er staat een geïmporteerde weeggeschiedenis
  in van honderden dagen zonder eten of training. Gebruik `logPeriode`/`wekenSpan`,
  en zet in de tekst over welke periode gerekend is.
- **Vakantiedagen** (`context.holiday`) tellen niet mee in volledigheid.
- **Dag-na-voetbal** (`naVoetbalDag`) is afgeleid uit gisteren, geen eigen vinkje.
  Een voetbaldag is het vinkje `context.football` óf een gelogde workout van het type
  zaalvoetbal of training. Voetbal en
  dag-na-voetbal kunnen tegelijk aan staan (twee speeldagen achter elkaar).

## Over de cijfers

- Dagverschillen in gewicht en lichaamssamenstelling zijn bijna altijd vocht en
  glycogeen. Een halve kilo vet is 3850 kcal. De weegschaal meet via weerstand, en
  die hangt aan het vochtgehalte. Trek geen conclusies uit één ochtend.
- In `predict.ts` telt de trendhelling bewust niet mee in de voorspelling voor
  morgen: op zijn echte data maakte dat de voorspelling slechter. De band komt uit
  werkelijke fouten. Lees de commentaarblokken voor je daar iets aan verandert.
- Geleerde effecten halen de lijst alleen als ze hun eigen standaardfout ruim
  overstijgen. Liever niets tonen dan ruis met een naam.
