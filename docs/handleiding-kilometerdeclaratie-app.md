# Handleiding — Kilometerdeclaratie (v3.01)

> Bron van de handleiding die in de app zelf zit. Staat als `handleiding.md` naast de code en wordt bij
> het bouwen in `Kilometerdeclaratie.html` gezet.


Deze handleiding hoort bij de app en zit in hetzelfde bestand: je kunt hem altijd openen via
**Handleiding** in de linkerbalk, ook zonder internet.

## In het kort

De app vervangt de Excel-rittenadministratie. Je kiest per dag je bestemmingen, de kilometers worden
automatisch ingevuld, en aan het eind van de maand exporteer je een PDF of Excel-bestand.

Drie dingen om te weten voordat je begint:

- De app start **helemaal leeg**. Er staan geen namen, adressen of ritten van iemand anders in het
  bestand. Alles wat je invult is van jou.
- Kies eenmalig een **opslagbestand** op je computer. Zonder dat staat je administratie alleen in deze
  browser.
- Alles rekent zichzelf uit: dagtotaal, maandtotaal en het declaratiebedrag.

## De app met meerdere personen gebruiken

Iedereen gebruikt een eigen kopie van `Kilometerdeclaratie.html` en een eigen opslagbestand. Er zit geen
gedeelde opslag in en er gaat niets naar een server: jouw ritten blijven op jouw computer.

Een collega laten meedoen gaat zo:

1. Geef de collega het bestand `Kilometerdeclaratie.html`, of laat hem het van de gedeelde schijf kopiëren.
2. De collega opent het en doorloopt het welkomstscherm met zijn eigen naam, kenteken en thuisadres.
3. De collega kiest zijn eigen opslagbestand — dus niet dat van jou.

Adressen en afstanden mag je wél delen: bij **Instellingen → Locaties en afstanden → Exporteren** maak je
een bestand met alleen de locaties en de bekende afstanden, zonder ritten en zonder persoonlijke
gegevens. Je collega leest dat in met **Importeren**.

Wil je zelf op twee computers werken? Gebruik dan hetzelfde opslagbestand in een gedeelde map, of
kopieer het bestand mee.

## Aan de slag: het welkomstscherm

De eerste keer dat je de app opent, verschijnt een welkomstscherm met drie stappen.

**Stap 1 · Jouw gegevens** — naam, auto of motor, kenteken en de vergoeding per kilometer. Die komen op
je export terecht en bepalen het declaratiebedrag.

**Stap 2 · Thuisadres** — je vaste vertrekpunt. Vanaf hier worden ritten geketend en werkt de knop
"Rit naar huis". Je kunt het adres opzoeken door een deel ervan in te typen.

**Stap 3 · Opslagbestand** — zie hieronder.

Daarnaast kun je optioneel een bestaande **lijst met locaties en afstanden** importeren, bijvoorbeeld uit
een spreadsheet die je al had. Dat scheelt later opzoekwerk. Je kunt dit ook overslaan en locaties gewoon
toevoegen terwijl je ritten invult.

Met **Aan de slag** rond je het scherm af; met **Later instellen** sla je het over en vul je alles later
bij Instellingen aan.

### Locaties en afstanden importeren

Bij **Instellingen → Locaties en afstanden → Importeren** plak je een tabel of kies je een bestand. De
tabel heeft vijf kolommen, gescheiden door een tab of een puntkomma:

| Naam van | Adres van | Naam naar | Adres naar | Km |
| --- | --- | --- | --- | --- |
| Thuis | 1234 AB 12, Utrecht | Hoofdkantoor | 5678 CD 3, Amersfoort | 44 |

Een kopregel wordt vanzelf overgeslagen. Adressen mogen op verschillende manieren geschreven zijn
(`1234 AB 12, Plaats`, `Straat 12, 1234 AB Plaats`, `1234 AB Plaats`). Locaties worden herkend aan
postcode, huisnummer en plaats, dus dubbel importeren levert geen dubbele locaties op. Elke afstand wordt
in beide richtingen opgeslagen.

Ook een eerder geëxporteerd JSON-bestand kun je hier inlezen.

## Opslagbestand kiezen

Bij de eerste keer openen verschijnt bovenaan een balk met twee keuzes.

- **Nieuw bestand maken…** — je wijst een plek en naam aan, bijvoorbeeld
  `Documenten\Kilometerdeclaratie.json`. Vanaf dat moment schrijft de app elke wijziging daar automatisch
  naartoe.
- **Bestaand bestand openen…** — je hebt al een administratiebestand, bijvoorbeeld op een andere computer
  gemaakt of teruggezet uit een back-up.

Zet je het bestand in een OneDrive- of netwerkmap, dan staat je administratie automatisch ook op je
andere apparaten.

Linksonder in de balk zie je de opslagstatus. Groen betekent opgeslagen; klik erop om naar de
instellingen te springen.

**Bij een volgende keer openen** vraagt Chrome eenmalig opnieuw toestemming voor dat bestand. Klik op
**Verbinden** in de balk. Wil je naar een ander bestand overstappen, gebruik dan **Ander bestand
openen…** in diezelfde balk.

Wijs je bij *Nieuw bestand maken* een bestand aan waar al een administratie in staat, dan waarschuwt de
app en kun je kiezen tussen die administratie openen, overschrijven of annuleren. Er gaat dus nooit
ongemerkt iets verloren.

## Een maand invullen

Kies de maand met de pijlen linksboven; **Deze maand** springt terug naar vandaag. Klik op een dag om
die open te klappen.

Binnen een dag heb je vier knoppen:

- **+ Rit toevoegen** — een lege rit. Het vertrekpunt is automatisch de bestemming van de vorige rit.
- **🏠 Rit naar huis** — sluit de dag af met een rit naar je thuisadres. Eindigt de dag daar al, dan is
  de knop uitgeschakeld.
- **Standaardrit** — zet je vaste rit heen en terug neer (in te stellen bij Instellingen).
- **Vorige rijdag kopiëren** — neemt de ritten over van de laatste dag met ritten.

Bovenaan de maand staat **⚡ Werkdagen vullen**: die zet de standaardrit in één keer op alle werkdagen
die nog leeg zijn. Dagen met een opmerking of met ritten blijven ongemoeid.

Dagen zonder zakelijke ritten krijgen alleen een opmerking. Met één klik op *Thuiswerken*, *Vakantie*,
*Verlof*, *Ziek* of *Feestdag* staat die er; je kunt ook zelf iets typen.

Met **Weekenden verbergen** houd je de lijst kort.

## Ritten en afstanden

Elke rit heeft een vertrekpunt, een bestemming en een aantal kilometers. Je kunt onbeperkt ritten per dag
toevoegen.

### Locatie kiezen

De keuzevelden zijn zoekvelden. Typ een deel van de naam, het adres of de plaats; de best passende
locatie staat bovenaan en kies je met **Enter**. Zoeken werkt op elk deel van de naam, niet alleen het
begin:

| je typt | je krijgt |
| --- | --- |
| `zuid` | Klant Rotterdam **Zuid** |
| `klant zuid` | losse termen mogen door de naam heen staan |
| `hoofdk` | Hoofdkantoor |
| `gouda` | alles met Gouda in het adres |

Met de pijltjestoetsen loop je door de lijst, **Escape** annuleert, en onderaan staat altijd
**Nieuwe locatie toevoegen…**. Typ je iets wat nergens op past en klik je weg, dan valt het veld terug op
je vorige keuze.

### Waar komen de kilometers vandaan?

Onder elk getal staat een klein label met de herkomst:

| label | betekenis |
| --- | --- |
| tabel | overgenomen uit je eigen afstandentabel |
| route | berekende route over de weg via OpenStreetMap |
| ≈ schatting | hemelsbrede afstand × 1,32; de route kon niet worden opgehaald |
| retour | gelijkgetrokken met dezelfde rit in omgekeerde richting |
| handmatig | zelf ingevuld; wordt niet automatisch herberekend |

Je kunt elk getal overschrijven; het krijgt dan het label *handmatig* en blijft staan. Met
**opnieuw berekenen** achter de regel laat je de app het alsnog zelf bepalen.

Staat een traject niet in je tabel, dan zoekt de app de adressen op en berekent de route over de weg.
Dat resultaat wordt bewaard, dus dat gebeurt maar één keer per traject.

### Heen en terug verschillen soms

Een routeplanner berekent elke richting apart over het echte wegennet, en met *altijd naar boven
afronden* wordt een verschil van enkele honderden meters al een hele kilometer. De instelling
**Heen- en terugreis gelijk houden** (standaard aan) voorkomt dat: is één richting bekend, dan neemt de
andere die over. Zijn beide bekend, dan wint de betrouwbaarste bron — je eigen tabel gaat vóór een
berekende route.

### Ritten verslepen

Het genummerde bolletje links van een rit is de sleepgreep. Sleep de rit naar een andere plek in de dag;
bij loslaten wordt de keten opnieuw gelegd, zodat elk vertrekpunt weer de bestemming van de rit erboven
is. De eerste rit blijft altijd bovenaan.

## Controles

De app kijkt per dag mee en kleurt wat aandacht vraagt.

- **Rood** — een rit waarin het vertrekpunt of de bestemming ontbreekt, of waarvan de afstand niet
  bepaald kon worden. De dag krijgt een rood label in de kop.
- **Oranje** — de laatste bestemming is niet je thuisadres. Die locatie wordt oranje weergegeven, met het
  label *eindigt niet thuis*. De knop **🏠 Rit naar huis** lost dat in één klik op.

Lukt een afstand niet, dan staat er precies welke locatie het probleem is, met een link om dat adres aan
te vullen en het daarna opnieuw te proberen. Meestal ontbreekt er een huisnummer of een postcode.

Er wordt niets geblokkeerd: de controles zijn er om te signaleren.

## Locaties en favorieten

Op het tabblad **Locaties** beheer je alle vertrek- en bestemmingslocaties.

- **Zoeken** op naam, plaats of postcode, en een **filter** op alle, favorieten, gebruikte of ongebruikte
  locaties.
- **Bewerken** opent naam en adres. Je kunt een adres opzoeken door te typen in het zoekveld bovenin het
  venster.
- **Als standaard** maakt een locatie je thuisadres.
- Het 📌-knopje zet een locatie handmatig bovenaan in de keuzelijsten.

### Favorieten gaan vanzelf

De meest gebruikte locaties van de **afgelopen zes maanden** staan bovenaan in elke keuzelijst onder
*Meest gebruikt*. Die lijst schuift dus mee met hoe je werkelijk rijdt. Het aantal stel je in bij
Instellingen (standaard 8). Zolang je nog geen ritten hebt ingevoerd is de lijst leeg; zet dan zelf je
vaste adressen bovenaan met het 📌-knopje.

### Locaties opruimen

Elke kaart heeft een selectievakje. Zodra je er één aanvinkt verschijnt een balk met het aantal
geselecteerde locaties, hoeveel daarvan in ritten voorkomen, **Alle zichtbare selecteren**,
**Selectie wissen** en de verwijderknop. Je selectie blijft staan als je de zoekterm wijzigt.

Zitten er locaties in je selectie die al gebruikt zijn, dan krijg je de keuze tussen *alleen de
ongebruikte* verwijderen of alles. Bij het verwijderen gaan ook de bekende afstanden van die locaties
weg.

De snelste opruimactie: filter op **Alleen ongebruikte**, klik **Alle zichtbare selecteren** en
verwijder.

## Exporteren

Op het tabblad **Overzicht** zie je de maand in tabelvorm, met bovenaan je naam, kenteken, totalen en het
declaratiebedrag.

- **Exporteer PDF** — staand A4 in de huisstijl, met iedere rit op een eigen regel. Datum, dag, opmerking
  en dagtotaal lopen samengevoegd over de regels van dezelfde dag. Een normale maand past op één pagina.
- **Exporteer Excel** — dezelfde kolomopzet als de oude rittenadministratie, met de bestemmingen naast
  elkaar per dag.
- **Afdrukken** — via het printvenster van je browser, ook bruikbaar als "Opslaan als PDF".

De bestandsnaam bevat automatisch de maand en je naam, bijvoorbeeld
`202606_HansdeRooij_rittenadministratie.pdf`.

## Instellingen

| onderdeel | waarvoor |
| --- | --- |
| Naam, voertuig, kenteken | komen op de export terecht |
| Vergoeding per kilometer | bepaalt het declaratiebedrag |
| Thuisadres | standaard vertrekpunt en doel van "Rit naar huis"; het volledige adres staat eronder |
| Aantal automatische favorieten | hoeveel locaties bovenaan de keuzelijsten staan |
| Afronding per rit | naar boven op hele km (standaard), rekenkundig, of niet afronden |
| Heen- en terugreis gelijk houden | voorkomt verschil tussen heen en terug |
| Standaardrit | wordt gebruikt door "Standaardrit" en "Werkdagen vullen" |
| Opslaglocatie | het bestand waarin alles wordt bewaard |
| Locaties en afstanden | een adressenlijst importeren of doorgeven aan een collega |
| Losse back-up | een kopie downloaden of terugzetten |

Let op bij het wijzigen van een adres: alleen postcode, huisnummer en plaats bepalen wáár een locatie
ligt. Een straatnaam aanvullen laat de bekende afstanden met rust. Verhuist een locatie echt, dan vraagt
de app of de opgeslagen afstanden opnieuw berekend moeten worden.

## Opslag, back-up en meerdere apparaten

Alles wat je invult — instellingen, locaties, afstanden en ritten — zit in één JSON-bestand. Alleen de
schakelaar *Automatisch opslaan* en de verwijzing naar het gekozen bestand blijven per apparaat in de
browser staan, samen met een noodkopie voor als het bestand even niet bereikbaar is.

**Naar een andere computer:** kopieer het HTML-bestand en het JSON-bestand, open de app daar en kies
*Bestaand bestand openen…*.

**De kopie in de browser:** naast je opslagbestand houdt de browser een eigen kopie bij, zodat er niets
verloren gaat als het bestand even niet bereikbaar is. Die kopie hoort bij de browser, niet bij een
bepaald bestand — open je een andere versie van de app in dezelfde browser, dan zie je dezelfde gegevens
terug. Met **Instellingen → Opnieuw beginnen (alles wissen)** wis je die kopie en ontkoppel je het
opslagbestand; het bestand zelf blijft gewoon staan.

**Back-up:** bij Instellingen kun je op elk moment een kopie downloaden en later terugzetten.

**Bestand buiten de app gewijzigd?** Bijvoorbeeld door synchronisatie of bewerking op een ander apparaat.
De app merkt dat en laat je kiezen tussen dat bestand laden of je eigen versie opslaan.

Rechtstreeks naar een bestand schrijven werkt in Chrome en Edge op de computer. In Safari en Firefox valt
de app terug op de browserkopie plus *Back-up downloaden*.

## Problemen oplossen

**"Afstand niet te bepalen"** — de melding noemt welke locatie het is. Vul het adres aan (postcode én
huisnummer) en klik op *opnieuw proberen*. Zonder internet kunnen alleen trajecten worden bepaald die al
bekend zijn.

**Heen en terug verschillen 1 km** — zet *Heen- en terugreis gelijk houden* aan bij Instellingen, of typ
het juiste getal handmatig.

**De app is leeg na het openen** — waarschijnlijk is de verbinding met het opslagbestand nog niet
hersteld. Klik op **Verbinden** in de balk bovenaan, of open het bestand via *Bestaand bestand openen…*.

**Ik zie gegevens terwijl ik nog geen opslagbestand heb gekoppeld** — dat is de kopie die de browser zelf
bewaart. De browser bewaart die kopie per browser, niet per bestand: alle lokaal geopende versies van de
app delen dezelfde opslagruimte. Open je dus een nieuwere versie van `Kilometerdeclaratie.html` in
dezelfde browser, dan ziet die de gegevens van de vorige versie staan. De balk bovenaan meldt dat ook.
Je hebt drie keuzes: **Bestaand bestand openen…** om verder te gaan met je eigen bestand,
**Nieuw bestand maken…** om deze gegevens in een nieuw bestand te zetten, of **Opnieuw beginnen** om met
een lege administratie te starten. Een collega die de app op zijn eigen computer opent begint altijd
leeg — die browser heeft immers nog geen kopie.

**Een locatie staat dubbel in de lijst** — verwijder de ongebruikte met de selectievakjes op het tabblad
Locaties.

**Het welkomstscherm is weg maar ik heb niets ingevuld** — alles uit dat scherm staat ook bij
Instellingen: naam, kenteken, vergoeding, thuisadres, opslagbestand en het importeren van locaties.

**Het versienummer klopt niet met wat je verwacht** — klik linksonder op het versienummer voor het
volledige overzicht van wijzigingen.

## Versienummers

Het versienummer staat linksonder in de balk; klikken opent *Instellingen → Over deze app* met de datum
en alle wijzigingen. De nummering loopt zo:

| soort wijziging | ophoging | voorbeeld |
| --- | --- | --- |
| klein | +0,01 | 2.00 → 2.01 |
| middelgroot | naar de eerstvolgende tiende | 2.01 → 2.10 |
| groot | naar het eerstvolgende hele nummer | 2.10 → 3.00 |
