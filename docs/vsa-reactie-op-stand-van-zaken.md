# Reactie op de stand van zaken van 05-11-2026

**Betreft:** Kilometerdeclaratie in VSA — verwerkt aan modulekant
**Module:** v3.24

Helder bericht, dank. De koers is overgenomen: VSA bouwt de inbouwstand, wij blijven eraf. Alles uit
jullie §5 is aan onze kant verwerkt. Hieronder wat er is gebeurd, en één ding dat met spoed jullie
kant op moet.

---

## ⚠️ Eerst dit: neem v3.22 niet over

Jullie schrijven dat het overnemen van 3.22 is ingepland. **Doe dat niet.**

In v3.22 heb ik `20-boot.js` hernoemd naar `90-boot.js`, om ruimte te maken voor een module erna.
Dat is precies een van de koppelpunten uit jullie §2: *"`01-core.js` opent hem, `20-boot.js` sluit
hem."* Die wijziging dateert van vóór jullie bericht, en is dus nooit gemeld — precies de situatie
die de meldplicht moet voorkomen.

In **v3.24 is dat hersteld.** De bestandsindeling is weer zoals jullie laag hem verwacht:

```
19-nieuws.js
19a-vsa-inbouw.js   <- jullie bestand landt hier
19b-meldingen.js    <- was 21-meldingen.js
20-boot.js          <- was 90-boot.js, sluit de IIFE weer
```

Jullie `19a-vsa-inbouw.js` valt daarmee in `sorted()`-volgorde opnieuw tussen `19-nieuws.js` en de
afsluiting, binnen de IIFE. **Neem v3.24**; die bevat alles wat in 3.22 zat (de schermen
"Wijziging aanvragen" en "Bug melden") plus dit herstel.

## 1. De inbouwstand is teruggedraaid

Tussen jullie contract v1 en dit bericht had ik fase 1 van voorstel H gebouwd: `?inbouw=vsa`, de
postMessage-brug, de `geo`-parameter, de GPS-vlag en een nagebootste VSA-pagina met testen. Dat is
in v3.24 **volledig verwijderd**. Die versie (3.23) heeft acceptatie gehaald maar productie nooit
bereikt, en staat niet in de zichtbare versiehistorie van de app.

Er reageert dus niets in de module op jullie berichten — geen tweede laag.

## 2. De koppelpunten staan nu in onze CI

Jullie suggestie uit §2 is overgenomen en is bij ons het equivalent van "past deze versie nog?".
`tests/test_vsa_koppelpunten.py` draait bij elke push en dekt:

| Wat | Hoe |
|---|---|
| De 14 functienamen uit §2 | bestaan nog als functie |
| `D` en `bannerVerborgen` | niet `const`, wel `let`/`var` |
| `opslag` | bestaat nog |
| De IIFE | `01-core.js` opent, `20-boot.js` sluit, en `19a-vsa-inbouw.js` landt ertussenin |
| Netwerk | geen `XMLHttpRequest`, `sendBeacon`, `EventSource`, `WebSocket`, `new Image()` |
| Externe hosts | alleen de bekende; een nieuwe laat de test falen |
| Huidige locatie | klasse `combo-item huidige`, precies één `getCurrentPosition`, geen `watchPosition` |
| Downloads | de vier succesmeldingen letterlijk, en een vijfde route valt op |

De controles zijn **gemuteerd getest**: een functie hernoemen, `D` op `const` zetten, een
`XMLHttpRequest` toevoegen, een downloadmelding wijzigen, een nieuwe host introduceren en het
hernoemen van `20-boot.js` werden allemaal gepakt. Een rode test geldt bij ons niet als bug maar
als meldplicht richting jullie.

Afspraak van onze kant: **wijzigt een koppelpunt, dan hoort u dat vóór de release.**

## 3. Eén punt waar ik het niet mee eens ben: de grens van 1 MB

Jullie verlagen de grens naar 1 MB en besluiten een uitweg en het opruimen van afgesloten jaren
**nu niet** op te pakken. Dat combineert ongelukkig met de cijfers die ik eerder stuurde:

| Profiel | Groei per jaar | 1 MB bereikt na |
|---|---:|---|
| Normale gebruiker | 100–200 kB | ongeveer 5–10 jaar |
| Veelrijder | 200–450 kB | **ongeveer 2–3 jaar** |

Een veelrijder loopt dus binnen twee à drie jaar tegen de grens — en krijgt dan een `fout` met
`"zeker": true`, zonder uitweg. Zijn wijziging staat in beeld en kan niet worden opgeslagen, en er
is geen knop die hem verder helpt.

Dat is jullie afweging, en ik leg me erbij neer. Maar ik wil het één keer expliciet gezegd hebben:
**dit is geen theoretisch randgeval, het is een voorzienbare datum.** Een minimale uitweg — de
gebruiker wijzen op exporteren en daarna een jaar laten opruimen — is aanmerkelijk goedkoper dan de
storing die er anders komt. Overweeg het alsnog op de backlog te zetten met die horizon erbij.

## 4. De rest: akkoord

- **A, downloads:** helder dat `allow-downloads` bewust uit staat en de laag het afvangt. Onze
  meting bevestigde het probleem; fijn dat die bruikbaar was.
- **C, het eerste `laden`:** goed dat dit als High is opgepakt. Aan onze kant is niets meer nodig.
- **D, dedupe op genormaliseerd adres:** prima oplossing, beter dan de `bronId` die ik voorstelde.
- **E, Overpass als POST:** akkoord.
- **F, melden verbergen:** akkoord. Wij bouwen daar niets voor; de schermen blijven in de losse app.
- **G en H:** vervallen, begrepen.
- **OSRM op 300 ms:** blijft staan.
- **Ondersteuning:** akkoord, beheer naar beste vermogen zonder toegezegde reactietijd.
- **Meetopzet:** die lever ik aan zodra jullie hem willen; zeg maar in welke vorm.

## 5. Nog openstaand aan onze kant

De git-tag per versie (jullie §2 en het contract) was nog niet ingevuld — er bestond geen enkele
tag. Dat is nu belegd: **v3.24** is de eerste. Eerdere versies krijgen met terugwerkende kracht
geen tag, omdat 3.22 en 3.23 juist de versies zijn die jullie niet moeten overnemen.

---

### Samengevat wat wij van jullie vragen

1. **Neem v3.22 niet over; neem v3.24.**
2. Overweeg de 1 MB-grens nog eens, met de horizon van twee à drie jaar voor een veelrijder.
