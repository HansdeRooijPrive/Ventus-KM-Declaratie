# Risicoregister — testset

Levend overzicht van de geautomatiseerde tests, **gestuurd op het risico** dat
elke test afdekt. Bij elke nieuwe functie of gevonden bug hoort hier een regel
bij (risico → test). Draaien: zie [`tests/`](.) en `requirements-test.txt`.

```bash
pip install -r requirements-test.txt
python -m playwright install chromium
pytest
```

De tests draaien ook automatisch bij elke push via `.github/workflows/tests.yml`.

## Tier 1 — pure logica (`test_pure.py`)

| # | Risico dat we afdekken | Test |
|---|------------------------|------|
| 1 | Verkeerde km-afronding → onjuist declaratiebedrag | `test_afrond_per_modus` |
| 2 | Foute hemelsbrede afstand → verkeerde nabijheidslogica ("Huidige locatie") | `test_haversine_amsterdam_utrecht` |
| 3 | Crash/lege weergave bij ontbrekende locatie (o.a. `locLabel(null)`) | `test_locatie_labels` |
| 4 | Adres-import leest Nederlandse notaties verkeerd → verkeerde locatie | `test_adres_parsing` |
| 5 | Heen/terug-afstand of bron-voorrang fout → verkeerde km | `test_paar_afstand_spiegel_en_bron` |
| 6 | Gearchiveerde locatie duikt weer op in de keuzelijst / verkeerde ranking | `test_combo_zoek_sluit_gearchiveerd_uit` |
| 7 | Migratie wist oude schattingen niet / nieuw veld ontbreekt | `test_migreer_ruimt_schatting_en_default_gelezen` |
| 8 | Datum-/maandlogica fout (schrikkeljaar, jaarwissel) | `test_datum_helpers` |
| 9 | Dag-/maandtotaal telt verkeerd | `test_dag_en_maand_km` |

## Tier 2 — DOM/integratie (`test_integration.py`)

| # | Risico dat we afdekken | Test |
|---|------------------------|------|
| 10 | App start niet / JS-fout breekt de pagina; menu-items missen | `test_menu_en_dagen_en_geen_bootfouten` |
| 11 | Tarief wordt niet correct per maand bewaard/getoond | `test_tarief_per_maand` |
| 12 | Locatie in gebruik verwijderen vernietigt administratie-data i.p.v. archiveren | `test_locatie_in_gebruik_wordt_gearchiveerd` |
| 13 | Dag met een verwijderde locatie kan niet meer opengeklapt worden (de oude crash) | `test_dag_met_verwijderde_locatie_klapt_open` |
| 14 | "Huidige locatie" maakt geen/verkeerde locatie of verliest GPS-coördinaten | `test_huidige_locatie_maakt_nieuwe_locatie` |
| 15 | Nieuwsbericht verschijnt niet / "als gelezen" werkt niet | `test_nieuws_popup_en_als_gelezen` |
| 16 | OneDrive-gebruiker ziet bij opstart geen inlogscherm (v3.17) | `test_onedrive_inlogscherm_bij_opstart` |
| 17 | Meerdere dagen tegelijk open → onoverzichtelijk; vorige dag klapt niet in (v3.18) | `test_accordeon_dagen` |
| 17b | Gebruiker kan de app niet installeren na het wegklikken van de browser-melding (v3.20) | `test_install_optie_bij_instellingen` |

## Tier 3 — build & integriteit (`test_build.py`)

| # | Risico dat we afdekken | Test |
|---|------------------------|------|
| 18 | `index.html` raakt uit sync met `src/` → verouderde code live | `test_build_check_slaagt` |
| 19 | App-code belandt in een vendor-bestand (versiebeheer onvindbaar) | `test_geen_appcode_in_vendor` |
| 20 | Productie gebruikt per ongeluk test-opslagsleutels | `test_prod_index_gebruikt_prod_sleutels` |
| 21 | Test- en prod-omgeving delen opslag (sed-isolatie kapot) | `test_deploy_isolatie_sed_patronen_matchen` |
| 22 | Syntaxfout in `src/` breekt de gebouwde app | `test_boot_zonder_console_fouten` |
| 23 | Test en prod niet te onderscheiden aan het app-icoon (groen autootje test / rood prod; v3.21) | `test_deploy_isolatie_sed_patronen_matchen` (icoon-herkleuring) |

## Bewust handmatig / niet automatisch gedekt

Deze vereisen echte credentials, hardware of netwerk en worden met de hand getest:

- **Echte OneDrive-login** (Microsoft OAuth met echte Client ID). *Beperking:* de suite dekt wél dat het inlogscherm verschijnt (#16) en dat de knop de PKCE-redirect start (handmatig geverifieerd), niet de volledige token-uitwisseling.
- **Na inloggen → scherm Maand** (v3.18): vereist een volledige OAuth-terugkeer; code geverifieerd, handmatig te bevestigen op de test-URL.
- **Mobiel fullscreen** (v3.18): `requestFullscreen`/PWA-installatie is in headless onbetrouwbaar; handmatig op een echt toestel.
- **Echte GPS-hardware** en **echte Nominatim/OSRM/Overpass-calls**: in de tests gemockt (#14, #2).
