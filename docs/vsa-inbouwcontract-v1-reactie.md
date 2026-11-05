# Reactie op inbouwcontract v1 — Kilometerdeclaratie in de Ventus Slimme Assistent

**Aan:** Michael van Lievenoogen
**Van:** Hans de Rooij
**Betreft:** contract v1 van 13 oktober 2026
**Module:** Ventus Kilometerdeclaratie v3.22

Het contract is helder en de taakverdeling klopt. Hieronder eerst de vijf antwoorden, gemeten aan
de code van v3.22 in plaats van geschat. Daarna zes punten die ik vóór akkoord aangepast wil zien;
twee daarvan zijn blokkerend.

---

## De vijf vragen

### 1. Hoe groot is een echt jaarbestand?

Gemeten aan gegenereerde administraties met het echte datamodel (locaties, maanden met dagen en
ritten, en de afstandencache):

| Profiel | Ritten/jaar | Ingesprongen JSON | Compact JSON |
|---|---:|---:|---:|
| Licht (150 dagen, 2 ritten/dag, 20 locaties) | 300 | 92 kB | 43 kB |
| Normaal (220 dagen, 3 ritten/dag, 60 locaties) | 660 | 206 kB | 98 kB |
| Intensief (230 dagen, 6 ritten/dag, 150 locaties) | 1.380 | 433 kB | 211 kB |

**Reken op 100–200 kB per jaar voor een normale gebruiker en 200–450 kB voor een veelrijder**,
afhankelijk van of jullie de JSON compact of ingesprongen opslaan. De losse app schrijft met
inspringing (`JSON.stringify(D, null, 2)`); via `postMessage` krijgen jullie een object, dus de
serialisatie is jullie keuze. Compact opslaan halveert het.

Let op: het is één document dat **cumulatief groeit**. Er is nu geen mechanisme dat oude maanden
opruimt of archiveert.

### 2. Is 2 MB ruim genoeg?

| Jaren intensief gebruik | Ingesprongen | Compact |
|---|---:|---:|
| 1 jaar | 433 kB | 211 kB |
| 3 jaar | 1,2 MB | 560 kB |
| 5 jaar | **1,9 MB** | 901 kB |
| 10 jaar (8 ritten/dag, 400 locaties) | 5,3 MB | 2,5 MB |

**Voor de eerste jaren ruim voldoende. Op termijn niet.** Een veelrijder zit na ongeveer vijf jaar
tegen de 2 MB als jullie ingesprongen opslaan, en na ongeveer tien jaar ook compact. Dat lijkt ver
weg, maar het is wél het moment waarop iemand zijn declaratie niet meer kan opslaan.

Zie blokkerend punt B hieronder: het protocol kent geen antwoord voor "te groot", dus zo'n
gebruiker krijgt straks "Opslaan is mislukt. Probeer het opnieuw." — en opnieuw proberen helpt niet.

### 3. Hoe vaak vraagt de module een adres op?

**Niet bij elke toetsaanslag.** De module is bewust zuinig:

- Het adres-zoekveld wacht **550 ms** nadat iemand stopt met typen en zoekt pas vanaf **4 tekens**
  (`src/app/11-modals.js`).
- De locatiekeuzelijst in een rit doet **geen enkele netwerkaanroep**: die filtert alleen de eigen
  locaties (`src/app/04-combo.js`).
- Afstanden zijn **cache-first**. `routeAfstand()` kijkt eerst in `D.afstanden`; alleen een
  combinatie die nog nooit is gereden levert één OSRM-aanroep op. Het resultaat wordt bewaard en
  nooit opnieuw opgehaald.
- `herbepaalAlleAfstanden()` rekent uitsluitend met de cache en doet nóóit netwerkverkeer.

**Een normale sessie — ritten invoeren tussen bekende locaties — doet dus nul aanvragen.** Verkeer
ontstaat alleen bij een nieuwe locatie: ongeveer 1–3 Nominatim-zoekopdrachten tijdens het typen,
1 geocodering, en 1 OSRM-aanroep per nieuwe locatiecombinatie. Bij een eerste inrichting met
10 nieuwe locaties praat je over grofweg 30–60 aanvragen, verspreid over de tijd die iemand nodig
heeft om ze in te typen.

**Twee dingen die jullie moeten weten voor het globale tempo:**

De module bewaakt het tempo al zelf, maar **per browser**, niet over medewerkers heen:

```
NOMQ      = 1150 ms tussen Nominatim-aanroepen   (onder de 1/s-grens)
OSRMQ     =  300 ms tussen OSRM-aanroepen        (dus tot ~3,3 per seconde)
OVERPASSQ = 1100 ms tussen Overpass-aanroepen
```

1. Die wachtrij helpt jullie niet bij het globale plafond. Met N gelijktijdige medewerkers kan VSA
   tot N aanvragen per seconde te verwerken krijgen. Het globale tempo moet dus hoe dan ook aan
   jullie kant bewaakt worden — zoals jullie ook al schrijven.
2. **De OSRM-wachtrij staat op 300 ms en overschrijdt de 1/s die jullie noemen al in je eentje.**
   Wil je dat de module zich ook per gebruiker aan 1/s houdt, dan zet ik die op 1100 ms. Zeg het,
   dan neem ik het mee; het kost alleen wat wachttijd bij het invoeren van veel nieuwe routes
   achter elkaar.

### 4. Dynamische code-evaluatie in jsPDF en SheetJS?

**Klopt: geen van beide gebruikt dynamische code-evaluatie.** Gecontroleerd op de ingesloten
bestanden:

| | `eval(` | `new Function` | `Function(` | `document.write` |
|---|---:|---:|---:|---:|
| `10-xlsx.min.js` (SheetJS 0.18.5, 245 kB) | 0 | 0 | 0 | 0 |
| `20-jspdf.min.js` (jsPDF 2.5.2, 395 kB) | 0 | 0 | 1* | 3* |

\* Beide zijn vals alarm, nagekeken in context:

- De treffer op `Function(` is onderdeel van de naam `headerFunction(`, niet de constructor.
- De drie `document.write` zitten in jsPDF's uitvoermodi die een **nieuw venster** openen
  (`pdfobjectnewwindow`, `pdfjsnewwindow`, `dataurlnewwindow`). De module gebruikt die niet: de
  export loopt via `doc.save(...)` en `XLSX.writeFile(...)`, beide de download-route
  (`src/app/09-export.js`). Die code wordt dus niet bereikt.

Eén van die venster-modi schrijft wel een `<script>`-tag. Mocht jullie CSP-scan daarover vallen:
het is dode code in ons gebruik, geen aanroeppad vanuit de module.

### 5. Werkt de export in een iframe?

**Gemeten, niet beredeneerd.** Ik heb de gebouwde `index.html` in een iframe gezet, de
export-knoppen ingedrukt en gekeken of er een bestand komt:

| iframe-variant | PDF | Excel |
|---|---|---|
| Geen `sandbox`-attribuut | ✅ 62 kB | ✅ 26 kB |
| `sandbox="allow-scripts allow-same-origin"` | ❌ **niets** | ❌ **niets** |
| `sandbox="allow-scripts allow-same-origin allow-downloads"` | ✅ 62 kB | ✅ 26 kB |

**De export werkt in een iframe — tenzij jullie het iframe sandboxen zonder `allow-downloads`.**
Dan gebeurt er precies wat jullie in punt 8 willen voorkomen: de knop staat er, je klikt, en er
gebeurt **niets**. Geen foutmelding, geen melding in de console, niets dat de module kan
opvangen en tonen.

Daarom blokkerend punt A hieronder.

---

## Wat ik aangepast wil zien

### A. Blokkerend — zet `allow-downloads` als MOET in het contract

Punt 8 noemt de export jullie belangrijkste functionele eis, maar legt de voorwaarde bij mij neer:
*"Als het downloaden binnen een kader anders moet dan nu, hoor je dat van ons."* Uit de meting
blijkt dat het precies andersom ligt: aan mijn kant hoeft er niets, aan jullie kant wel.

Graag als **MOET** aan jullie kant: *het iframe krijgt geen `sandbox`-attribuut, of een
`sandbox` die `allow-downloads` bevat.*

Ik kan dit niet aan mijn kant afvangen of zelfs maar detecteren — vandaar dat het in het contract
hoort en niet in een mailtje.

### B. Blokkerend — het protocol kent geen antwoord voor "te groot"

Jullie hanteren 2 MB, maar `bewaren` kent maar drie antwoorden: `bewaard`, `conflict` en `fout`
met de tekst *"Opslaan is mislukt. Probeer het opnieuw."* Een document over de limiet is geen
tijdelijke storing: opnieuw proberen helpt nooit, en de gebruiker heeft op dat moment ritten in
het scherm staan die hij niet kwijt kan.

Voorstel, in volgorde van voorkeur:

1. Een eigen antwoord, bijvoorbeeld `{ "type": "fout", "reden": "te-groot", "melding": "…" }`, zodat
   de module een bruikbare uitweg kan tonen (exporteer eerst, dan oude maanden opruimen).
2. En een afspraak over **opruimen**: punt 8 zegt dat jullie de ritten niet jarenlang hoeven te
   bewaren omdat de export de administratie is. Dat is precies het argument om afgesloten jaren te
   kunnen verwijderen — maar er staat nergens hoe. Zonder dat mechanisme groeit het document tot
   het tegen de limiet loopt.

### C. Het eerste `laden` kan werk overschrijven

Punt 2 zegt: *"De module accepteert een `laden` alleen als antwoord op zijn eigen `gereed` of
`herladen` … Zo kan een laat binnenkomend antwoord nooit werk overschrijven dat de gebruiker
intussen deed."*

Dat werkt voor een `herladen`, maar niet voor de eerste keer. Bij een trage server is dit het
scenario: de module stuurt `gereed`, krijgt niets, begint leeg, de medewerker typt alvast ritten in
— en op t=30 s komt het `laden` alsnog binnen. Dat ís het antwoord op `gereed`, dus de module
accepteert het en de ingetypte ritten zijn weg.

Voorstel: maak van de huidige **MAG** ("na 10 seconden een melding") een **MOET**, en wel zo dat de
module **de invoer blokkeert tot het eerste `laden` binnen is**. Wachten is vervelend; stilletjes
werk kwijtraken is erger. Ik bouw dat graag, maar dan moet het in het contract staan.

### D. Punt 7 heeft geen sleutel om dubbele import te herkennen

De ontdubbeling gaat op "zelfde datum, van, naar, km". Dat werkt zolang adressen identiek
terugkomen, maar een adres dat net anders geschreven is (`Kerrieweg 7` tegenover
`Kerrieweg 7, 1234 AB`) wordt een nieuwe locatie, en dan is het geen dubbele meer.

Voorstel: geef per rit een stabiele `bronId` mee uit het CSV-bestand (bijvoorbeeld rit-id of een
hash van de regel). Dan kan ik hard ontdubbelen en is twee keer importeren altijd veilig.

### E. Punt 5: Overpass is een POST

De module roept Nominatim en OSRM met GET aan, maar **Overpass met POST** (`src/app/05-geo.js`).
Het doorgeefluik moet dat ondersteunen. Verder prima werkbaar; ik vervang de drie vaste adressen
door de `geo`-basis zoals beschreven.

### F. Punt 1 is geschreven vóór v3.22 — wat doen we met "melden"?

Het contract is van 13 oktober; op 19 oktober is v3.22 uitgekomen. Daarin staan onder **Hulp** twee
nieuwe onderdelen: **Wijziging aanvragen** (user story) en **Bug melden**. Die vallen nu onder
"Handleiding, Nieuws en Over deze app verbergen", wat waarschijnlijk klopt — maar dat is niet
bewust besloten.

Vraag: nemen jullie het melden over in VSA, of laat ik de twee schermen in de inbouwstand staan?
Ze versturen via de mailclient van de medewerker naar een Jira-mailhandler; binnen een iframe werkt
`mailto` doorgaans wel, maar dat wil ik dan meten, net als bij de export.

---

## Over de rest van het contract

De opzet bevalt me. Een paar dingen die ik expliciet goed vind:

- De stekkermetafoor klopt: `contract: 1` plus `dataVersie` maakt dat een nieuwe versie van mij
  nooit stil verkeerd gaat werken bij jullie.
- Het conflictprotocol is bijna gelijk aan wat de module al doet voor OneDrive (eTag → 412 →
  dezelfde keuzevraag). Dat scheelt veel werk en is al beproefd.
- Dat jullie het samenvoegen, het tempo, de CSV-controle en de kaartdiensten-proxy op je nemen is
  de juiste knip. De module blijft daarmee onwetend van VSA, precies zoals bedoeld.
- Het vasthouden aan git-tag plus gecommitte `index.html` sluit aan op wat `build.py --check` al
  afdwingt.

Twee kanttekeningen bij de inleiding. Er staat *"zonder dat je er iets in hoeft te herbouwen"* en
*"wat jij NIET hoeft te doen"*. Dat is voor de architectuur waar, maar het werk is niet klein: er
komt een berichtenlaag bij, een derde opslagvorm, een volledige-administratie-import, een
ritten-import en de kaartdiensten-parameter — plus regressietests, want dit raakt de opslag van
echte declaraties. Reken op meerdere dagen, niet op een middag. Dat is geen bezwaar, maar laten we
het wel zo noemen.

En: de inbouwstand is daarna **permanent onderhoud** in een module die ik in eigen tijd beheer.
Elke toekomstige wijziging moet ik tegen dit contract blijven testen. De toegezegde testpagina helpt
daar echt bij; die zou ik graag hebben vóór ik begin, niet erna.

---

## Samengevat

Vijf antwoorden staan hierboven, gemeten. Punten **A** en **B** wil ik in het contract verwerkt
zien voordat ik eraan begin — beide gaan over een gebruiker die stil zijn werk kwijtraakt. **C**
graag erbij, **D**, **E** en **F** zijn kleine aanscherpingen die we in één ronde kunnen afhandelen.

Met die aanpassingen kan het wat mij betreft door als **contract v1.1** en kan ik aan de slag.

---

### Hoe deze antwoorden tot stand zijn gekomen

Alles is gemeten op v3.22 (commit op `development`), niet geschat:

- Omvang: gegenereerde administraties met het echte datamodel, geserialiseerd zoals de app dat doet.
- Aanvraagtempo: gelezen uit `src/app/05-geo.js`, `11-modals.js` en `04-combo.js`.
- Vendor-scan: letterlijke zoekopdrachten op de ingesloten bestanden, elke treffer in context
  nagekeken.
- Export in iframe: de gebouwde `index.html` in drie iframe-varianten, met een echte klik op de
  export-knoppen en controle of er een bestand binnenkomt.
