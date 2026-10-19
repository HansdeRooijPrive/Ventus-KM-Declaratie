# Jira inrichten voor meldingen uit de app — Ventus Kilometerdeclaratie

Instructie voor de Jira-beheerder. Na deze inrichting komen wijzigingsverzoeken en
bugmeldingen uit de app automatisch als issue in Jira terecht.

**Benodigde rechten:** Jira-beheerder (voor *Instellingen → Systeem → Inkomende mail*) en
projectbeheerder van het doelproject.

**Status:** het adres is bekend en staat al in `app.json` (`waarden.JIRA_MAIL_BUG`), voor alle
drie de omgevingen. De app kan dus versturen zodra de handler aan de Jira-kant staat. Tot die
tijd komt de mail aan maar gebeurt er niets mee.

---

## 1. Hoe het werkt

De app is een statische webpagina zonder server. Hij kan daarom niet zelf naar de Jira-API
schrijven: een API-token in de pagina zou publiek leesbaar zijn. In plaats daarvan stelt de app
een volledig opgemaakte e-mail samen en opent die in de mailclient van de melder. De melder
verstuurt hem zelf, waarna Jira er een issue van maakt.

Gevolg: **de afzender is altijd een echte, geauthenticeerde Ventus-medewerker.** Er is geen open
endpoint naar Jira en dus geen spamrisico van buiten.

## 2. Wat er binnenkomt

De app stuurt platte tekst. Het onderwerp is de titel van het issue, de body de beschrijving.

**Onderwerp**

```
[BUG] Totaal van de maand klopt niet
[STORY] Rit kunnen dupliceren
```

**Body — bug**

```
Type: Bug
Titel: Totaal van de maand klopt niet

*Stappen om te reproduceren*
1. Open Maand
2. Voeg een rit toe van A naar B

*Verwacht resultaat*
Totaal 20 km

*Werkelijk resultaat*
Totaal 10 km

*Frequentie*
altijd

*Impact*
blokkerend — ik kan niet verder

*Melder*
Jan Jansen

*Technische context (automatisch meegestuurd)*
App-versie:     3.22 (2026-10-19)
Omgeving:       Productie
Opslagmodus:    OneDrive (meerdere apparaten)
Scherm in app:  Maand
Browser:        Chrome 141 op Windows 10/11
Schermformaat:  1920 × 1080 (venster 1280 × 900)
Tijdstip:       2026-10-19 14:32 (Europe/Amsterdam)
User agent:     Mozilla/5.0 (...)

Er zijn geen gegevens uit de kilometeradministratie meegestuurd.
```

**Body — wijzigingsverzoek** heeft dezelfde opbouw, met bovenaan de user story:

```
Type: Story
Titel: Rit kunnen dupliceren

*User story*
Als medewerker die declareert wil ik een rit kunnen dupliceren zodat ik niet alles opnieuw hoef in te voeren

*Acceptatiecriteria*
- Knop staat op de ritregel
- De kopie is daarna los te wijzigen

*Urgentie*
graag binnenkort
...
```

De `*sterretjes*` zijn Jira-wiki-opmaak voor vet. Rendert Jira ze niet, dan blijft de tekst
gewoon leesbaar.

> **Privacy.** Er komen nooit ritten, locaties, adressen, kentekens of bedragen uit de
> administratie mee — alleen de technische context hierboven. Dit is met een geautomatiseerde
> test vastgelegd (`test_melding_stuurt_geen_administratiegegevens_mee`). De melder kan in het
> formulier uitklappen wat er precies wordt verstuurd.

## 3. Eén adres — en wat dat betekent voor het issuetype

**Er is één e-mailadres:**

```
jira@ventustestprofessionals.atlassian.net
```

Bugs en wijzigingsverzoeken gaan daar allebei heen; het onderwerp maakt het onderscheid:

```
[BUG]   Totaal van de maand klopt niet
[STORY] Rit kunnen dupliceren
```

Meldingen uit test en acceptatie krijgen de omgeving er direct achter, zodat een proefmelding in
de issuelijst niet voor een echte wordt aangezien. Productie heeft geen marker:

```
[BUG] [TEST]        Totaal van de maand klopt niet
[STORY] [ACCEPTATIE] Rit kunnen dupliceren
```

Een mailhandler in Jira heeft echter **één** standaard-issuetype. Alles wat binnenkomt krijgt dus
in eerste instantie hetzelfde type. Kies daarvoor **`Bug`**: een verkeerd getypeerde bug valt
eerder op dan een verkeerd getypeerde wens, en bugs hebben vaker haast.

Voor het omzetten van de `[STORY]`-meldingen zijn er twee werkwijzen:

| | Werkwijze | Wat het kost |
|---|---|---|
| **Handmatig** | Bij het triagen zet je een `[STORY]`-issue om naar type `Story` | Enkele seconden per verzoek; geen inrichting nodig. Veilig startpunt. |
| **Automatisch** | Een automatiseringsregel: *als het onderwerp begint met `[STORY]`, zet issuetype op `Story`* | Eenmalige inrichting. Let op: het issuetype wijzigen via automation werkt niet in elke Jira-configuratie (afhankelijk van het issuetype-schema en de veldconfiguratie). Probeer het, en val terug op handmatig als Jira het weigert. |

> Blijkt het onderscheid in de praktijk te omslachtig, dan is een tweede adres alsnog mogelijk:
> een tweede handler met standaardtype `Story`. De app ondersteunt dat al — er hoeft alleen een
> adres in `app.json` bij.

## 4. Route A — Jira Service Management (voorkeur als jullie dat hebben)

Heeft Ventus JSM, gebruik dan het ingebouwde e-mailverzoekkanaal: dat is per project te activeren
en vereist geen eigen postbus of mailhandler. Je krijgt per verzoektype een adres. Maak één
verzoektype dat op `Bug` uitkomt, noteer dat adres en ga door naar stap 6.

## 5. Route B — Jira Software / Work Management

### 5.1 Doelproject

Kies of maak het project dat de meldingen ontvangt, bijvoorbeeld `Ventus Kilometerdeclaratie`
(sleutel bijv. `KMD`). Controleer dat de issuetypes **`Bug`** en **`Story`** in het issuetype-schema
van dat project zitten.

> Let op: een **team-managed** project kent geen mailhandlers via *Systeem → Inkomende mail*. Is
> het project team-managed, gebruik dan route A, of maak een **company-managed** project aan.

### 5.2 Mailserver

Ga naar **Instellingen → Systeem → Inkomende mail**.

Het gekozen adres `jira@ventustestprofessionals.atlassian.net` is het adres van de
**standaard-mailserver van Jira Cloud**. Er is dus geen eigen postbus nodig — je hoeft hier alleen
te controleren dat die server beschikbaar is, en door naar 5.3.

Werkt die server niet voor het aanmaken van issues (zie *Aandachtspunten*), dan is de uitwijk een
**eigen POP/IMAP-postbus**, bijvoorbeeld een shared mailbox in Microsoft 365. In dat geval
verandert het adres en moet dat teruggekoppeld worden, zodat het in `app.json` aangepast kan
worden. Let bij M365 op dat basic authentication is uitgefaseerd; gebruik de OAuth-koppeling die
Jira voor Microsoft-accounts aanbiedt.

### 5.3 De mailhandler

Maak onder *Inkomende mail* één handler aan:

| Instelling | Waarde |
|---|---|
| Handlertype | Maak een nieuw issue van elke e-mail |
| Project | `KMD` |
| Standaard-issuetype | **Bug** (zie stap 3 voor het omzetten van `[STORY]`) |
| Mailserver | uit 5.2 |
| Adres / map | `jira@ventustestprofessionals.atlassian.net` |
| Melder (reporter) | afzender, of een vaste gebruiker als fallback |
| Quotes/ondertekening strippen | aan |

Belangrijk bij **Melder**: de afzender wordt alleen als reporter gezet als die een Jira-account
heeft. Melders zonder account hebben een fallback-gebruiker nodig, anders wordt de mail
weggegooid. De naam van de melder staat altijd óók in de body (`*Melder*`), dus die informatie
gaat niet verloren.

### 5.4 Verplichte velden

Jira weigert een aanmaak waarbij een verplicht veld ontbreekt. De mail vult alleen **titel** en
**beschrijving**. Zorg daarom dat op het aanmaakscherm van `Bug` en `Story` geen andere velden
verplicht zijn (prioriteit, component, team, epic, sprint), of geef ze een standaardwaarde.

**Dit is de meest voorkomende oorzaak van "de mail komt aan maar er gebeurt niets".**

## 6. Testen

1. Stuur handmatig een mail naar het adres met onderwerp `[BUG] Test vanuit mail` en wat tekst in
   de body.
2. Wacht één pollinterval (standaard circa een minuut) en controleer of het issue in `KMD` staat,
   met issuetype `Bug` en de body als beschrijving.
3. Herhaal met onderwerp `[STORY] Test vanuit mail`. Heb je de automatiseringsregel uit stap 3
   ingericht, controleer dan of het issuetype op `Story` komt te staan; zo niet, dan is handmatig
   omzetten de werkwijze.
4. Loopt het mis: **Instellingen → Systeem → Inkomende mail → logboek** van de handler vertelt
   waarom (onbekende afzender, verplicht veld, geen rechten).

## 7. Wat er aan de app-kant al staat

Dit is al ingeregeld, er hoeft niets meer aangeleverd te worden:

```json
"JIRA_MAIL_BUG":   { "prod": "jira@ventustestprofessionals.atlassian.net",
                     "acc":  "jira@ventustestprofessionals.atlassian.net",
                     "test": "jira@ventustestprofessionals.atlassian.net" },
"JIRA_MAIL_STORY": { "prod": "", "acc": "", "test": "" }
```

`JIRA_MAIL_STORY` is leeg: de app stuurt de wijzigingsverzoeken naar hetzelfde adres, met
`[STORY]` in het onderwerp. Komt er later een tweede adres voor stories, dan wordt alleen dit
veld gevuld.

Alle drie de omgevingen gebruiken hetzelfde adres, zodat de keten op test te beproeven is
vóórdat hij naar productie gaat. Test- en acceptatiemeldingen zijn aan het onderwerp te
herkennen (`[TEST]`, `[ACCEPTATIE]`). Wil je ze helemaal niet in Jira hebben, laat het weten —
dan worden `acc` en `test` leeggemaakt en bieden die omgevingen alleen "Kopieer melding".

## Aandachtspunten

- **Het adres is site-breed, niet projectgebonden.** `jira@<site>.atlassian.net` is het algemene
  inkomende adres van de Jira-site; welk project een mail raakt, bepaalt de handler. Bestaat er al
  een handler op dit adres voor een ander project, controleer dan dat de twee elkaar niet in de
  weg zitten.
- **Standaard-mailserver van Jira Cloud:** er zijn meldingen van gebruikers bij wie die wél
  commentaar toevoegde maar géén nieuwe issues aanmaakte. Werkt het niet, wijk dan uit naar een
  eigen IMAP-postbus (5.2, optie 2).
- **Lange meldingen:** mailclients weigeren een `mailto`-link boven circa 2000 tekens. De app
  detecteert dat, zet de melding op het klembord en vertelt de melder naar welk adres en met welk
  onderwerp hij hem moet sturen. Er gaat dus niets stil verloren.
- **Bijlagen en schermafbeeldingen:** een `mailto`-link kan geen bijlage meegeven. De melder kan
  wel zelf een schermafbeelding aan de geopende mail toevoegen voordat hij verstuurt — het loont
  om dat in de communicatie te vermelden.
- **Geen ontvangstbevestiging in de app:** de app weet niet of de mail daadwerkelijk is verstuurd;
  dat gebeurt in de mailclient van de melder. Overweeg een automatiseringsregel in Jira die de
  melder een bevestiging stuurt.

## Herkomst van deze instructie

De stappen volgen Atlassian's documentatie over het aanmaken van issues uit e-mail. Twee punten
zijn niet uit Atlassian's eigen documentatie te bevestigen en komen van leveranciersgidsen en
communityberichten: dat het issuetype **per handler** wordt ingesteld (waardoor alles binnenkomt
als één type), en de hierboven genoemde beperking van de standaard-mailserver. Controleer die
twee in de admin-console voordat je erop bouwt.
