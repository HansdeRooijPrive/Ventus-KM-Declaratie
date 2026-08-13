# Bronstructuur

De app wordt uitgeleverd als **één** self-contained `index.html` (werkt offline,
is als bijlage te mailen, en de deploy draait er `sed`-transformaties op). De
broncode staat hier opgesplitst; `build.py` (in de repo-root) voegt alles weer
byte-voor-byte samen tot `index.html`.

## Bouwen

```bash
python build.py          # (her)bouwt index.html uit src/
python build.py --check  # faalt als index.html niet overeenkomt met src/
```

Er is **geen** Node/npm nodig — alleen Python 3.

## Structuur

| Pad | Inhoud |
|-----|--------|
| `src/index.template.html` | HTML-romp met de placeholders `{{STYLES}}` en `{{SCRIPT}}` (bevat alle view-markup en de handleiding-tekst) |
| `src/styles.css` | De volledige opmaak (het `<style>`-blok) |
| `src/vendor/xlsx.min.js` | SheetJS (Excel-export) — vendored, **niet bewerken** |
| `src/vendor/jspdf.min.js` | jsPDF (PDF-export) — vendored, **niet bewerken** |
| `src/app/NN-*.js` | De app-code, genummerde fragmenten van **één** IIFE, in leesvolgorde |

De `app/`-modules delen één scope (het zijn fragmenten van dezelfde IIFE, in
alfabetische/numerieke volgorde samengevoegd). Een nieuwe module toevoegen kan
door een bestand met het juiste volgnummer (bijv. `21-...js`) neer te zetten;
`build.py` pakt het automatisch op.

## Modules

- `01-core` constanten, opslag-object, `save()`, datamodel-init
- `02-helpers` algemene helpers + locatie-helpers
- `03-favorieten` automatische favorieten
- `04-combo` zoekende locatiekiezer (dropdown)
- `05-geo` geocoding (Nominatim/OSRM/Overpass) + "Huidige locatie" via GPS
- `06-model` maand-/dagmodel, maandinstellingen, afstandsberekening
- `07-view-maand` maandweergave, dagenlijst, verslepen, maandnavigatie
- `08-view-overzicht` maandoverzicht
- `09-export` PDF- en Excel-export
- `10-view-locaties` locatiebeheer
- `11-modals` dialogen + versie-informatie
- `12-import-export` locaties/afstanden importeren en exporteren
- `13-welkom` welkomstscherm
- `14-handleiding` handleiding-opbouw en zoeken
- `15-storage-file` opslag in een zelfgekozen bestand (File System Access API)
- `16-onedrive` OneDrive-opslag (Microsoft Graph, OAuth PKCE)
- `17-instellingen` instellingen
- `18-navigatie` navigatie tussen views
- `19-nieuws` nieuwsberichten-mechanisme
- `20-boot` opstartvolgorde + `window.__km` + afsluiting van de IIFE

## Deploy

De GitHub Actions-workflows bouwen per branch `index.html` uit `src/` (als
`build.py` aanwezig is) en rollen dat uit. `verify-build.yml` controleert bij
elke push dat de ingecheckte `index.html` overeenkomt met `src/`.
