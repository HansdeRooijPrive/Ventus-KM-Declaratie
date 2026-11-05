# Tegenvoorstel op inbouwcontract v1 — Kilometerdeclaratie in de Ventus Slimme Assistent

**Aan:** Michael van Lievenoogen
**Van:** Hans de Rooij
**Betreft:** contract v1 van 13 oktober 2026 → voorstel voor **v1.1**
**Module:** Ventus Kilometerdeclaratie v3.22

Michael, dank — dit is een goed doordacht stuk. De stekkermetafoor klopt, de taakverdeling is
verstandig geknipt, en `contract` plus `dataVersie` zorgt ervoor dat een nieuwe versie van mij nooit
stil verkeerd kan gaan werken bij jullie. Daar wil ik graag aan meewerken.

Hieronder staan eerst jullie vijf vragen beantwoord. Ik heb ze **gemeten aan v3.22** in plaats van
geschat; één van de antwoorden verandert wat er in het contract moet staan.

Daarna doe ik acht voorstellen voor v1.1. Drie daarvan zou ik graag vooraf geregeld zien, en ik stel
voor de oplevering in twee fasen te knippen — dat halveert ruwweg wat er vóór de eerste werkende
koppeling gebouwd moet worden.

---

## Deel 1 — De vijf vragen, gemeten

### 1. Hoe groot is een echt jaarbestand?

Gemeten op gegenereerde administraties met het echte datamodel (locaties, maanden met dagen en
ritten, en de afstandencache):

| Profiel | Ritten/jaar | Ingesprongen JSON | Compact JSON |
|---|---:|---:|---:|
| Licht — 150 dagen, 2 ritten/dag, 20 locaties | 300 | 92 kB | 43 kB |
| Normaal — 220 dagen, 3 ritten/dag, 60 locaties | 660 | 206 kB | 98 kB |
| Intensief — 230 dagen, 6 ritten/dag, 150 locaties | 1.380 | 433 kB | 211 kB |

**Reken op 100–200 kB per jaar voor een normale gebruiker en 200–450 kB voor een veelrijder.**

Het verschil tussen de twee kolommen is de serialisatie. De losse app schrijft met inspringing
(`JSON.stringify(D, null, 2)`); via `postMessage` krijgen jullie een object, dus die keuze is aan
jullie kant. Compact opslaan halveert het.

Belangrijk: dit is één document dat **cumulatief groeit**. Er is nu geen mechanisme dat afgesloten
jaren opruimt of archiveert.

### 2. Is 2 MB ruim genoeg?

| Jaren intensief gebruik | Ingesprongen | Compact |
|---|---:|---:|
| 1 jaar | 433 kB | 211 kB |
| 3 jaar | 1,2 MB | 560 kB |
| 5 jaar | **1,9 MB** | 901 kB |
| 10 jaar — 8 ritten/dag, 400 locaties | 5,3 MB | 2,5 MB |

**De eerste jaren ruim voldoende; op termijn niet.** Een veelrijder zit na ongeveer vijf jaar tegen
de 2 MB als jullie ingesprongen opslaan, en na ongeveer tien jaar ook compact.

Dat lijkt ver weg, maar het is wél precies het moment waarop iemand zijn declaratie niet meer kan
opslaan — en dat is het moment waarop het pijn doet. Zie voorstel **B**.

### 3. Hoe vaak vraagt de module een adres op?

**Niet bij elke toetsaanslag.** De module is daar bewust zuinig in:

- Het adres-zoekveld wacht **550 ms** nadat iemand stopt met typen en zoekt pas vanaf **4 tekens**
  (`src/app/11-modals.js`).
- De locatiekeuzelijst bij een rit doet **geen enkele netwerkaanroep**; die filtert alleen de eigen
  locaties (`src/app/04-combo.js`).
- Afstanden zijn **cache-first**: `routeAfstand()` kijkt eerst in `D.afstanden` en doet alleen een
  OSRM-aanroep voor een combinatie die nog nooit gereden is. Het resultaat wordt bewaard en nooit
  opnieuw opgehaald.
- `herbepaalAlleAfstanden()` rekent uitsluitend met de cache en doet nóóit netwerkverkeer.

**Een normale sessie — ritten invoeren tussen bekende locaties — doet dus nul aanvragen.** Verkeer
ontstaat alleen bij een nieuwe locatie: ongeveer 1–3 Nominatim-zoekopdrachten tijdens het typen,
één geocodering, en één OSRM-aanroep per nieuwe locatiecombinatie. Een eerste inrichting met tien
nieuwe locaties komt op grofweg 30–60 aanvragen, verspreid over de tijd die iemand nodig heeft om
ze in te typen.

Twee dingen die jullie moeten weten voor het globale tempo. De module bewaakt het tempo al zelf,
maar **per browser**, niet over medewerkers heen:

```
NOMQ      = 1150 ms tussen Nominatim-aanroepen   (onder de 1/s-grens)
OSRMQ     =  300 ms tussen OSRM-aanroepen        (dus tot ~3,3 per seconde)
OVERPASSQ = 1100 ms tussen Overpass-aanroepen
```

1. Die wachtrij helpt jullie niet bij het globale plafond. Met N gelijktijdige medewerkers kan VSA
   tot N aanvragen per seconde te verwerken krijgen; het globale tempo moet dus hoe dan ook aan
   jullie kant bewaakt worden, zoals jullie ook al schrijven.
2. **De OSRM-wachtrij staat op 300 ms en overschrijdt de 1/s die jullie noemen al in zijn eentje.**
   Wil je dat de module zich ook per gebruiker aan 1/s houdt, dan zet ik hem op 1100 ms. Dat kost
   alleen wat wachttijd bij het achter elkaar invoeren van veel nieuwe routes. Zeg maar.

### 4. Dynamische code-evaluatie in jsPDF en SheetJS?

**Jullie bevinding klopt: geen van beide gebruikt dynamische code-evaluatie.** Gecontroleerd op de
ingesloten bestanden:

| | `eval(` | `new Function` | `Function(` | `document.write` |
|---|---:|---:|---:|---:|
| `10-xlsx.min.js` — SheetJS 0.18.5, 245 kB | 0 | 0 | 0 | 0 |
| `20-jspdf.min.js` — jsPDF 2.5.2, 395 kB | 0 | 0 | 1* | 3* |

\* Beide zijn vals alarm; ik heb elke treffer in context nagekeken:

- De treffer op `Function(` is onderdeel van de naam `headerFunction(`, niet de constructor.
- De drie `document.write` zitten in jsPDF's uitvoermodi die een **nieuw venster** openen
  (`pdfobjectnewwindow`, `pdfjsnewwindow`, `dataurlnewwindow`). De module gebruikt die niet: de
  export loopt via `doc.save(...)` en `XLSX.writeFile(...)`, beide de download-route
  (`src/app/09-export.js`). Die code wordt dus nooit bereikt.

Eén van die venster-modi schrijft wel een `<script>`-tag. Mocht jullie beveiligingsscan daarover
vallen: het is dode code in ons gebruik, zonder aanroeppad vanuit de module.

### 5. Werkt de export in een iframe?

Gemeten, niet beredeneerd. Ik heb de gebouwde `index.html` in een iframe gezet, de export-knoppen
echt ingedrukt en gekeken of er een bestand binnenkomt:

| iframe-variant | PDF | Excel |
|---|---|---|
| Geen `sandbox`-attribuut | ✅ 62 kB | ✅ 26 kB |
| `sandbox="allow-scripts allow-same-origin"` | ❌ **niets** | ❌ **niets** |
| `sandbox="allow-scripts allow-same-origin allow-downloads"` | ✅ 62 kB | ✅ 26 kB |

**De export werkt in een iframe — tenzij het iframe gesandboxed wordt zonder `allow-downloads`.**
Dan gebeurt precies wat jullie in punt 8 willen voorkomen: de knop staat er, de medewerker klikt,
en er gebeurt **niets**. Geen foutmelding, geen melding in de console, niets dat mijn module kan
opvangen of tonen.

Dit draait jullie punt 8 om: aan mijn kant hoeft er niets, aan jullie kant wel. Zie voorstel **A**.

---

## Deel 2 — Voorstellen voor v1.1

### A. `allow-downloads` als MOET aan VSA-zijde — graag vooraf geregeld

Punt 8 noemt de export jullie belangrijkste functionele eis, maar legt de voorwaarde bij mij:
*"Als het downloaden binnen een kader anders moet dan nu, hoor je dat van ons."* Uit de meting
hierboven blijkt dat het andersom ligt.

> **Voorstel (MOET, VSA):** het iframe krijgt geen `sandbox`-attribuut, of een `sandbox` die
> `allow-downloads` bevat.

Ik kan dit aan mijn kant niet afvangen en zelfs niet detecteren — de klik levert geen enkel signaal
op. Daarom hoort het in het contract en niet in een mail.

### B. Een antwoord voor "te groot", plus opruimen — graag vooraf geregeld

`bewaren` kent nu drie antwoorden: `bewaard`, `conflict` en `fout` met *"Opslaan is mislukt. Probeer
het opnieuw."* Een document over de 2 MB is geen tijdelijke storing: opnieuw proberen helpt nooit,
en de medewerker heeft op dat moment ritten in beeld die hij niet kwijt kan.

> **Voorstel 1 (MOET, VSA):** een herkenbaar antwoord, bijvoorbeeld
> `{ "km": 1, "type": "fout", "reden": "te-groot", "melding": "…" }`. Dan kan de module een
> bruikbare uitweg tonen — eerst exporteren, dan oude maanden opruimen — in plaats van een
> vruchteloos "probeer opnieuw".
>
> **Voorstel 2 (afspraak):** een manier om afgesloten jaren op te ruimen of te archiveren.

Dat tweede sluit aan op jullie eigen punt 8: de export ís de administratie, dus jullie hoeven de
ritten niet jarenlang te bewaren. Dat is precies het argument om ze te kúnnen verwijderen — alleen
staat nergens hoe. Zonder dat mechanisme groeit het document tot het tegen de limiet loopt.

### C. Het eerste `laden` kan werk overschrijven

Punt 2 zegt: *"De module accepteert een `laden` alleen als antwoord op zijn eigen `gereed` of
`herladen` … Zo kan een laat binnenkomend antwoord nooit werk overschrijven dat de gebruiker
intussen deed."*

Dat werkt voor een `herladen`, maar niet voor de eerste keer. Bij een trage server: de module
stuurt `gereed`, krijgt niets, begint leeg, de medewerker typt alvast ritten in — en op t=30 s komt
het `laden` alsnog. Dat ís het antwoord op `gereed`, dus de module accepteert het, en de ingetypte
ritten zijn weg.

> **Voorstel (MOET, module):** van de huidige MAG ("na 10 seconden een melding") een MOET maken, en
> wel zo dat de module **de invoer blokkeert tot het eerste `laden` binnen is**.

Wachten is vervelend; stilletjes werk kwijtraken is erger. Ik bouw dit graag, maar dan wil ik het
in het contract hebben staan.

### D. Punt 7 heeft geen sleutel om dubbele import te herkennen

De ontdubbeling gaat op "zelfde datum, van, naar, km". Dat werkt zolang adressen identiek
terugkomen, maar een adres dat net anders geschreven is (`Kerrieweg 7` tegenover
`Kerrieweg 7, 1234 AB`) wordt een nieuwe locatie — en dan is het geen dubbele meer.

> **Voorstel (MOET, VSA):** geef per rit een stabiele `bronId` mee uit het CSV-bestand, bijvoorbeeld
> een rit-id of een hash van de regel.

Dan kan ik hard ontdubbelen en is twee keer importeren altijd veilig.

### E. Punt 5: Overpass is een POST

De module roept Nominatim en OSRM met GET aan, maar **Overpass met POST** (`src/app/05-geo.js`). Het
doorgeefluik moet dat ondersteunen. Verder prima werkbaar: ik vervang de drie vaste adressen door
de `geo`-basis zoals beschreven.

### F. Het contract is van vóór v3.22 — wat doen we met "melden"?

Het contract is van 13 oktober; op 19 oktober is v3.22 uitgekomen. Daarin staan onder **Hulp** twee
nieuwe onderdelen: **Wijziging aanvragen** (user story) en **Bug melden**. Die vallen nu onder
"Handleiding, Nieuws en Over deze app verbergen", wat waarschijnlijk de bedoeling is — maar dat is
nooit bewust besloten.

> **Vraag:** nemen jullie het melden over in VSA, of laat ik de twee schermen in de inbouwstand
> staan?

Ze versturen via de mailclient van de medewerker naar een Jira-mailhandler. Binnen een iframe werkt
`mailto` doorgaans wel, maar als jullie ze willen houden, meet ik dat eerst — net als bij de export.

### G. Acceptatie: wanneer is het af, en wie stelt dat vast? — graag vooraf geregeld

Dit is wat mij betreft de belangrijkste toevoeging. Het contract beschrijft de koppeling tot in
detail, maar niet **wanneer die correct is geïmplementeerd**. Er is geen acceptatieprocedure en geen
moment waarop we samen vaststellen dat het werkt. De toegezegde testpagina komt "zodra hij er is";
dat is een voornemen, geen afspraak.

> **Voorstel 1:** de testpagina is er **vóórdat ik begin**, niet erna. Anders bouw ik blind en test
> ik tegen mijn eigen aannames in plaats van tegen jullie implementatie.
>
> **Voorstel 2:** een gezamenlijke scenariolijst die beide kanten draaien en die **aantoonbaar groen
> is vóórdat er iets naar productie gaat**.

Die lijst moet nadrukkelijk de gevallen bevatten waarin een medewerker gegevens kwijt zou kunnen
raken. Dit voedt de salarisadministratie; een verloren rit is een verloren declaratie. Mijn
voorstel voor de lijst:

| # | Scenario | Verwacht |
|---|---|---|
| 1 | `laden` komt pas na 30 s, medewerker heeft intussen getypt | Geen verlies — invoer was geblokkeerd (voorstel C) |
| 2 | `laden` met `data: null` | Lege administratie, geen fout |
| 3 | Conflict → "andere versie laden" | Andere versie staat in beeld, eigen wijziging bewust vervallen |
| 4 | Conflict → "mijn versie opslaan" | Eigen versie opgeslagen, met het versienummer uit het conflict |
| 5 | `bewaren` beantwoord met `fout` | Melding zichtbaar, **gegevens blijven in beeld**, opnieuw opslaan werkt |
| 6 | Document over de limiet | Herkenbare melding met uitweg (voorstel B), niet "probeer opnieuw" |
| 7 | Twee tabbladen tegelijk open | Geen stille overschrijving; conflict verschijnt |
| 8 | Sessie verlopen / opnieuw inloggen | Geen verlies van wat in beeld stond |
| 9 | Export PDF en Excel in het iframe | Er komt een bestand (voorstel A) |
| 10 | Browser sluiten direct na een wijziging | Wijziging is bewaard of aantoonbaar niet — nooit half |

Scenario's 1 tot en met 8 liggen grotendeels aan jullie kant, omdat de opslag daar zit. Ik lever de
module zodanig op dat ze te draaien zijn.

### H. Fasering: knip de oplevering in tweeën

Alle acht punten staan nu op MOET, maar twee ervan zijn geen koppeling:

- **Punt 4** — volledige administratie importeren — is een migratiehulp voor overstappers.
- **Punt 7** — ritten uit CSV — is een feature.

De werkende koppeling zit in de punten 1, 2, 3, 5, 6 en 8.

> **Voorstel:**
>
> | Fase | Inhoud | Resultaat |
> |---|---|---|
> | **1** | Punten 1, 2, 3, 5, 6, 8 + voorstellen A, B, C, E, G | Een draaiende module in VSA |
> | **2** | Punten 4 en 7 + voorstel D | Migratie en CSV-import |

Daarmee krijgen jullie eerder een werkende integratie, is er veel minder in één keer te testen, en
houdt een bug in de import de hele koppeling niet op. De twee importfuncties zijn bovendien precies
de onderdelen waar het datamodel het meest op de proef wordt gesteld; die wil ik liever bouwen op
een brug die al bewezen staat.

---

## Deel 3 — Ondersteuning

Ik beheer deze module in eigen tijd. Wat jullie van mij kunnen verwachten:

- Ik los fouten in de module op **naar beste vermogen**, zonder toegezegde reactietijd.
- Elke versie krijgt een git-tag en een gecommitte, gebouwde `index.html`, zoals jullie vragen.
- Wijzigingen die het contract raken, meld ik vooraf.

Dat is geen voorbehoud vooraf, maar wel eerlijk om vast te leggen: plan er geen leverancier-achtige
toezeggingen omheen.

---

## Deel 4 — Wat ik aan mijn kant doe

Los van wat het contract vraagt, bouw ik **een nabootsing van VSA als geautomatiseerde test in mijn
eigen repository**, die bij elke wijziging meedraait in CI. Daarmee is "past versie 3.23 nog op het
contract?" een testuitslag in plaats van een gesprek, en ben ik voor doorontwikkelen niet
afhankelijk van jullie testpagina.

Dat past bij hoe de module al wordt bewaakt: er is een risicoregister waarin elke test aan een
concreet risico hangt, en de bestaande opslagafspraken zijn al zo vastgelegd. De contractberichten
komen daarbij.

---

## Samengevat

| | |
|---|---|
| **Graag vooraf geregeld, in v1.1** | **A** `allow-downloads`, **B** "te groot" + opruimen, **G** acceptatie en scenariolijst |
| **In dezelfde ronde mee te nemen** | **H** fasering, **C** eerste `laden`, **F** besluit over melden |
| **Tijdens het bouwen af te stemmen** | **D** `bronId`, **E** Overpass als POST |

A, B en G hebben één ding gemeen: zonder die drie kunnen we niet aantonen dát het goed gaat, en
gaat het bij alle drie om een medewerker die stil zijn werk kwijtraakt.

Wat ik van jullie nodig heb om te kunnen beginnen:

1. Het aangepaste contract als **v1.1**.
2. De testpagina.
3. Een antwoord op **F** (melden in de inbouwstand, ja of nee).
4. Akkoord op de fasering uit **H**.

Met die vier kan ik aan fase 1 beginnen.

---

### Bijlage — hoe deze antwoorden tot stand zijn gekomen

Alles is gemeten op v3.22, niet geschat:

- **Omvang:** gegenereerde administraties met het echte datamodel, geserialiseerd zoals de app dat
  doet en zoals een compacte opslag dat zou doen.
- **Aanvraagtempo:** gelezen uit `src/app/05-geo.js`, `11-modals.js` en `04-combo.js`.
- **Vendor-scan:** letterlijke zoekopdrachten op de ingesloten bestanden, elke treffer in context
  nagekeken en beoordeeld.
- **Export in iframe:** de gebouwde `index.html` in drie iframe-varianten geladen, met een echte
  klik op beide export-knoppen en controle of er een bestand binnenkomt.

De meetopzet kan ik desgewenst meeleveren, zodat jullie de cijfers zelf kunnen reproduceren.
