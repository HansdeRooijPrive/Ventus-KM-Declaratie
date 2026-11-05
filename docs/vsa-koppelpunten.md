# Koppelpunten met de Ventus Slimme Assistent

VSA draait deze module binnen een kader in zijn portaal. **De module weet daar zelf niets van.**
VSA bouwt de inbouwstand als een eigen laag die bij het bouwen in onze bundel wordt geplaatst:

| Bestand van VSA | Waar | Wat het doet |
|---|---|---|
| `00a-vsa-inbouw-voor.js` | vóór de module | leidt `localStorage` om naar de VSA-server, wikkelt `fetch` voor de kaartdiensten |
| `19a-vsa-inbouw.js` | **binnen** onze IIFE | spreekt het volledige berichtenschema met de VSA-pagina |

Dat tweede bestand landt in `sorted()`-volgorde tussen `19-nieuws.js` en `19b-meldingen.js`, dus
binnen de IIFE die `01-core.js` opent en `20-boot.js` sluit. Het deelt daardoor onze scope.

> **Bouw hier zelf niets voor.** Geen `?inbouw=vsa`, geen postMessage-brug, geen `geo`-parameter.
> Doen we dat wel, dan reageren er twee lagen op dezelfde berichten.
> (Besluit VSA 13-10-2026; bevestigd in hun stand van zaken van 05-11-2026.)

## Wat we dus wél moeten doen: deze namen en vormen laten staan

De laag van VSA grijpt aan op onderstaande namen. Verandert er iets, dan **meld het bij VSA vóór de
release** — hun `km_update.py` weigert de bundel anders bij het bouwen.

`tests/test_vsa_koppelpunten.py` bewaakt dit alles in CI. Een rode test daar is geen bug maar een
melding: er is iets veranderd waar VSA van moet weten.

### Functies
`gaNaar` · `migreer` · `defaultData` · `tekenMaand` · `tekenOverzicht` · `tekenLocaties` ·
`vulInstellingen` · `tekenOpslag` · `save` · `geldigeData` · `toast` — en voor de rittenimport van
VSA: `getDag` · `parseAdres` · `uid`

### Variabelen
`D` en `bannerVerborgen` worden door de laag **overschreven** en moeten daarom `let` of `var`
blijven. Worden ze `const`, dan mislukt het laden bij VSA **zonder melding**. `opslag` moet blijven
bestaan.

### De bouw
`build.py` voegt `src/app/*.js` in `sorted()`-volgorde samen tot één IIFE: `01-core.js` opent hem,
`20-boot.js` sluit hem. Een nieuw app-bestand moet dus tussen die twee sorteren — vandaar
`19b-meldingen.js` in plaats van `21-...`.

### Netwerk
Kaartdiensten **alleen via `fetch`**. Niet via `XMLHttpRequest`, `sendBeacon`, `EventSource`,
`WebSocket` of `new Image()`: de laag wikkelt alleen `fetch`, de rest gaat daarlangs en faalt op
productie stil. Een **nieuwe externe host** vooraf melden.

### Locatie
De keuze "Huidige locatie" draagt de klasse `combo-item huidige`; er is **precies één**
`navigator.geolocation.getCurrentPosition(…)` en **geen** `watchPosition`. VSA verbergt de keuze
zelf wanneer de beheerder de locatiefunctie uit heeft staan — wij hoeven daar niets voor te doen.

### Downloads
VSA's kader mag zelf niets downloaden (`allow-downloads` staat bewust niet in de sandbox). De laag
vangt een klik op een anker met `download` en een blob-URL op en geeft het bestand aan de
VSA-pagina. Onze vier succesmeldingen worden door VSA vervangen door een eigen melding:

`PDF gedownload` · `Excel-bestand gedownload` · `Back-up gedownload` · `<n> locaties geëxporteerd`

Wijzigt een van die teksten, of komt er een **vijfde downloadroute** bij, dan vooraf melden.

### Per versie
Een **git-tag** (`v3.24`) en een gecommitte, gebouwde `index.html`. VSA haalt bij een tag het
bestand op en legt de vingerafdruk vast. `build.py --check` borgt het tweede al.

## Wat nog openstaat aan de VSA-kant

- **De grens is 1 MB per administratie, niet 2 MB.** Gemeten groei is 100–200 kB per jaar voor een
  normale gebruiker en 200–450 kB voor een veelrijder (zie
  `docs/vsa-inbouwcontract-v1-reactie.md`). Een veelrijder loopt daarmee binnen twee à drie jaar
  tegen die grens. VSA heeft besloten een uitweg en het opruimen van afgesloten jaren **nu niet**
  op te pakken; zij geven bij overschrijding een `fout` met `"zeker": true`. Dat is hun keuze, maar
  het blijft een gebruiker die zijn declaratie niet meer kan opslaan.
- **Het eerste `laden`** (voorstel C) is door VSA erkend als bug met prioriteit High en wordt aan
  hun kant opgelost.
