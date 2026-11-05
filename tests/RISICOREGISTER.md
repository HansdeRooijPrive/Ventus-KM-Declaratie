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
| 24 | Meldopties ontbreken onder Hulp of het formulier mist velden (v3.22) | `test_meld_menu_en_formulieren` |
| 25 | Bugmelding komt zonder stappen/context in Jira → niet na te zoeken (v3.22) | `test_bug_melding_bevat_alle_kopjes_en_context` |
| 26 | Wijzigingsverzoek belandt niet in user-story-vorm (v3.22) | `test_wijziging_wordt_user_story` |
| 27 | **Privacy:** een melding lekt ritten, locaties, adressen of bedragen uit de administratie (v3.22) | `test_melding_stuurt_geen_administratiegegevens_mee` |

## Tier 4 — inbouwstand en VSA-contract (`test_inbouw.py`)

Draait tegen `tests/vsa-sim.html`, een nabootsing van het portaal. De scenario's volgen de
acceptatielijst uit voorstel G van `docs/vsa-inbouwcontract-v1-reactie.md`: elk geval waarin een
medewerker gegevens zou kunnen kwijtraken, heeft hier een test.

| # | Risico dat we afdekken | Test |
|---|------------------------|------|
| 29 | Portaal krijgt niet te horen welk contract/versie de module spreekt | `test_gereed_draagt_contract_en_versies` |
| 30 | Administratie van het portaal komt niet of verkeerd binnen | `test_laden_vult_de_administratie` |
| 31 | Leeg document (`data: null`) geeft een fout in plaats van een lege administratie | `test_scenario2_laden_met_null_start_leeg` |
| 32 | **Administratie blijft in de gedeelde browseropslag achter voor de volgende gebruiker** | `test_geen_browseropslag_in_de_inbouwstand` |
| 33 | Vreemd of onvolledig bericht verstoort de module | `test_onbekende_berichten_worden_genegeerd` |
| 34 | Tabbladen van het portaal lopen niet gelijk; niet-toegestane view wordt toch geopend | `test_ga_en_view_lopen_gelijk` |
| 35 | Eigen zijbalk, hulp of opslagpaneel blijft zichtbaar binnen het portaal | `test_eigen_zijbalk_en_hulp_zijn_weg` |
| 36 | GPS-knop verschijnt terwijl het portaal die niet heeft toegestaan | `test_huidige_locatie_volgt_de_vlag` |
| 37 | Kaartdiensten gaan rechtstreeks naar buiten in plaats van via het portaal | `test_geo_parameter_stuurt_de_kaartdiensten_om` |
| 38 | Wijziging wordt vertraagd of niet doorgegeven aan het portaal | `test_bewaren_gaat_direct_en_zonder_vertraging` |
| 39 | **Mislukt opslaan draait de invoer terug of gaat stil voorbij** | `test_scenario5_fout_laat_de_gegevens_staan` |
| 40 | **Document over de limiet geeft "probeer opnieuw" in plaats van een uitweg** | `test_scenario6_te_groot_geeft_een_uitweg` |
| 41 | **Elders gewijzigd: andere versie laden werkt niet** | `test_scenario3_conflict_andere_versie_laden` |
| 42 | **Elders gewijzigd: eigen versie opslaan overschrijft niet, of met het verkeerde versienummer** | `test_scenario4_conflict_mijn_versie_opslaan` |
| 43 | **Trage server: ingetypt werk wordt overschreven door een laat binnenkomend laden** | `test_scenario1_traag_laden_blokkeert_de_invoer` |
| 44 | **Ongevraagd `laden` overschrijft werk** | `test_laat_laden_zonder_verzoek_wordt_genegeerd` |
| 45 | Export levert binnen een kader geen bestand op (declaratie niet in te leveren) | `test_scenario9_export_werkt_in_het_kader` |
| 46 | Teksten over bestanden, OneDrive of "deze browser" lekken het portaal in | `test_geen_verwijzingen_naar_eigen_opslag_in_het_kader` |
| 47 | Opslagstatus toont de verkeerde werkelijkheid binnen het portaal | `test_opslaghint_volgt_het_portaal` |

## Tier 3 — build & integriteit (`test_build.py`)

| # | Risico dat we afdekken | Test |
|---|------------------------|------|
| 18 | `index.html` raakt uit sync met `src/` → verouderde code live | `test_build_check_slaagt` |
| 19 | App-code belandt in een vendor-bestand (versiebeheer onvindbaar) | `test_geen_appcode_in_vendor` |
| 20 | Productie gebruikt per ongeluk test-opslagsleutels | `test_prod_index_gebruikt_prod_sleutels` |
| 21 | Test- en prod-omgeving delen opslag (sed-isolatie kapot) | `test_omgevingen_hebben_eigen_opslag` |
| 22 | Syntaxfout in `src/` breekt de gebouwde app | `test_boot_zonder_console_fouten` |
| 23 | Test en prod niet te onderscheiden aan het app-icoon (groen autootje test / rood prod; v3.21) | `test_omgevingen_hebben_eigen_opslag` (icoon-herkleuring) |
| 28 | Proefmelding uit test/acceptatie komt in Jira binnen alsof hij uit productie komt (v3.22) | `test_omgevingen_hebben_eigen_opslag` (omgevingsstempel `MELD_OMGEVING`) |

## Bewust handmatig / niet automatisch gedekt

Deze vereisen echte credentials, hardware of netwerk en worden met de hand getest:

- **Echte OneDrive-login** (Microsoft OAuth met echte Client ID). *Beperking:* de suite dekt wél dat het inlogscherm verschijnt (#16) en dat de knop de PKCE-redirect start (handmatig geverifieerd), niet de volledige token-uitwisseling.
- **Na inloggen → scherm Maand** (v3.18): vereist een volledige OAuth-terugkeer; code geverifieerd, handmatig te bevestigen op de test-URL.
- **Mobiel fullscreen** (v3.18): `requestFullscreen`/PWA-installatie is in headless onbetrouwbaar; handmatig op een echt toestel.
- **Echte GPS-hardware** en **echte Nominatim/OSRM/Overpass-calls**: in de tests gemockt (#14, #2).
- **Het daadwerkelijk aankomen van een melding in Jira** (v3.22): vereist een ingevuld `JIRA_MAIL` in
  `app.json`, een mailhandler op het Jira-project en een mailclient op het toestel. De suite dekt wél
  dat de melding juist en volledig wordt opgebouwd (#24–#27); het openen van de mailclient
  (`location.href = 'mailto:…'`) en de rest van de keten is handmatig te bevestigen.
