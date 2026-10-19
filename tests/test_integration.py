"""Tier 2 — DOM/integratie via headless Chromium. Zie tests/RISICOREGISTER.md."""
import datetime

from conftest import alle_bericht_ids, leeg_dossier

YM = datetime.date.today().strftime("%Y-%m")   # huidige maand = wat de app toont
GELEZEN = alle_bericht_ids()   # onderdruk de nieuws-popup; groeit automatisch mee met nieuwe berichten


def test_menu_en_dagen_en_geen_bootfouten(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    views = pg.evaluate("() => Array.from(document.querySelectorAll('#tabs button')).map(b=>b.dataset.view)")
    for v in ["maand", "overzicht", "locaties", "instellingen", "handleiding", "nieuws", "over"]:
        assert v in views
    assert pg.evaluate("() => document.querySelectorAll('.day').length") >= 28
    assert pg.evaluate("() => window.__errs") == []


def test_tarief_per_maand(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    pg.fill("#stRate", "0,40")
    pg.dispatch_event("#stRate", "input")
    assert pg.evaluate("() => window.__km.D.maanden[Object.keys(window.__km.D.maanden)[0]].vergoeding") == 0.40
    pg.click("#nextMonth")
    assert pg.input_value("#stRate") == "0,25"       # andere maand: standaardtarief
    pg.click("#prevMonth")
    assert pg.input_value("#stRate") == "0,40"       # terug: eigen tarief blijft


def test_locatie_in_gebruik_wordt_gearchiveerd(app):
    d = leeg_dossier(
        locaties=[{"id": "L1", "naam": "Alpha", "plaats": "Utrecht", "aliassen": []},
                  {"id": "L2", "naam": "Beta", "plaats": "Amsterdam", "aliassen": []}],
        maanden={YM: {"dagen": {YM + "-05": {"opmerking": "",
                 "ritten": [{"id": "r", "van": "L1", "naar": "L2", "km": 10, "kmA": 10}]}}}},
        gelezenBerichten=GELEZEN,
    )
    pg = app(storage=d)
    pg.click('#tabs button[data-view="locaties"]')
    # verwijder Alpha (in gebruik) -> moet archiveren
    pg.click('.loc[data-id="L1"] [data-act="del"]')
    pg.click('.backdrop .modal [data-x="ja"]')
    row = pg.locator('.loc[data-id="L1"]')
    row.wait_for()
    assert row.evaluate("el => el.classList.contains('gearchiveerd')") is True
    assert "gearchiveerd" in row.locator(".badge").inner_text()
    # combo biedt de gearchiveerde locatie niet meer aan
    ids = pg.evaluate("() => { const z = window.__km.fns.comboZoek(''); return z.fav.concat(z.rest).map(l=>l.id); }")
    assert "L1" not in ids and "L2" in ids


def test_dag_met_verwijderde_locatie_klapt_open(app):
    ds = YM + "-15"
    d = leeg_dossier(
        locaties=[{"id": "REAL", "naam": "Kantoor", "plaats": "Utrecht", "aliassen": []}],
        maanden={YM: {"dagen": {ds: {"opmerking": "",
                 "ritten": [{"id": "r", "van": "REAL", "naar": "GHOST", "km": 10, "kmA": 10}]}}}},
        gelezenBerichten=GELEZEN,
    )
    pg = app(storage=d)
    head = pg.locator('.day[data-ds="%s"] .day-head' % ds)
    head.wait_for()
    if not pg.locator('.day[data-ds="%s"] .day-body' % ds).count():
        head.click()
    pg.locator('.day[data-ds="%s"] .day-body' % ds).wait_for(timeout=3000)  # klapt open zonder fout
    assert pg.evaluate("() => window.__errs") == []


def test_huidige_locatie_maakt_nieuwe_locatie(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN), geolocation={"latitude": 52.0907, "longitude": 5.1214})
    pg.route("**/nominatim.openstreetmap.org/**", lambda r: r.fulfill(
        status=200, content_type="application/json",
        body='{"address":{"road":"Domplein","house_number":"29","postcode":"3512 JE","city":"Utrecht"},"namedetails":{"name":"Domplein"}}'))
    pg.route("**/overpass-api.de/**", lambda r: r.fulfill(
        status=200, content_type="application/json",
        body='{"elements":[{"lat":52.0906,"lon":5.1213,"tags":{"name":"Grand Café De Dom","amenity":"restaurant"}}]}'))
    # open eerste dag + voeg rit toe
    first = pg.locator(".day").first
    ds = first.get_attribute("data-ds")
    if not pg.locator('.day[data-ds="%s"] .day-body' % ds).count():
        pg.locator('.day[data-ds="%s"] .day-head' % ds).click()
    pg.locator('.day[data-ds="%s"] [data-act="addtrip"]' % ds).click()
    naar = pg.locator('.day[data-ds="%s"] .trip[data-i="0"] .naar input.combo-input' % ds)
    naar.focus()
    huidige = pg.locator("#comboPaneel .combo-item.huidige")
    huidige.wait_for()
    huidige.click()
    # locatiemodal opent, voorgevuld met POI-naam
    pg.locator(".backdrop .modal #lmNaam").wait_for(timeout=5000)
    assert pg.input_value(".backdrop .modal #lmNaam") == "Grand Café De Dom"
    assert pg.input_value(".backdrop .modal #lmStraat") == "Domplein"
    pg.click('.backdrop .modal [data-x="ja"]')
    pg.wait_for_function("() => window.__km.D.locaties.some(l => l.naam === 'Grand Café De Dom')")
    loc = pg.evaluate("() => window.__km.D.locaties.find(l => l.naam === 'Grand Café De Dom')")
    assert loc["lat"] == 52.0907 and loc["lon"] == 5.1214   # GPS-coördinaten bewaard


def test_nieuws_popup_en_als_gelezen(app):
    pg = app(storage=leeg_dossier())   # ingericht (geen welkom) + gelezenBerichten leeg -> eerste ongelezen verschijnt
    modal = pg.locator("#modalHost .backdrop .modal")
    modal.wait_for(timeout=3000)
    assert "Huidige locatie" in modal.locator("h3").inner_text()      # eerste bericht
    # Alle berichten achter elkaar wegmarkeren; het aantal volgt de bron, niet een vast getal.
    for i in range(len(GELEZEN)):
        modal.locator("h3").wait_for()
        pg.click('#modalHost .backdrop .modal [data-x="gelezen"]')
    assert pg.locator("#modalHost .backdrop").count() == 0            # geen ongelezen bericht meer
    assert pg.evaluate("() => window.__km.D.gelezenBerichten.length") == len(GELEZEN)


def test_onedrive_inlogscherm_bij_opstart(app):
    d = leeg_dossier(settings={"opslagModus": "onedrive", "odClientId": "00000000-1111-2222-3333-444455556666"})
    pg = app(storage=d)
    modal = pg.locator("#modalHost .backdrop .modal")
    modal.wait_for(timeout=4000)
    assert "Inloggen bij OneDrive" in modal.locator("h3").inner_text()
    labels = pg.evaluate("() => Array.from(document.querySelectorAll('#modalHost .backdrop .modal [data-x]')).map(b=>b.dataset.x)")
    assert "login" in labels and "later" in labels


def test_accordeon_dagen(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    days = pg.evaluate("() => Array.from(document.querySelectorAll('.day')).slice(0,2).map(d=>d.dataset.ds)")
    d1, d2 = days[0], days[1]
    body1 = '.day[data-ds="%s"] .day-body' % d1
    body2 = '.day[data-ds="%s"] .day-body' % d2
    if not pg.locator(body1).count():
        pg.locator('.day[data-ds="%s"] .day-head' % d1).click()
    pg.locator(body1).wait_for()
    pg.locator('.day[data-ds="%s"] .day-head' % d2).click()
    pg.locator(body2).wait_for()
    assert pg.locator(body1).count() == 0     # vorige dag klapt in (accordeon)


def test_install_optie_bij_instellingen(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    pg.click('#tabs button[data-view="instellingen"]')
    pg.locator("#installKaart").wait_for()
    # toont óf de installatieknop óf de handmatige uitleg (headless krijgt geen prompt)
    assert pg.locator("#installVak").inner_text().strip() != ""


def test_meld_menu_en_formulieren(app):
    """Beide meldopties staan onder Hulp en renderen hun formulier."""
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    views = pg.evaluate("() => Array.from(document.querySelectorAll('#tabs button')).map(b=>b.dataset.view)")
    assert "wijziging" in views and "bug" in views

    pg.click('#tabs button[data-view="bug"]')
    pg.locator("#meldForm-bug .field").first.wait_for()
    for k in ["samenvatting", "stappen", "verwacht", "werkelijk", "frequentie", "hinder", "melder"]:
        assert pg.locator("#meld-bug-%s" % k).count() == 1, k

    pg.click('#tabs button[data-view="wijziging"]')
    pg.locator("#meldForm-wijziging .field").first.wait_for()
    for k in ["samenvatting", "rol", "wens", "waarde", "criteria", "urgentie", "melder"]:
        assert pg.locator("#meld-wijziging-%s" % k).count() == 1, k

    # Naam uit Instellingen wordt voorgevuld, zodat de melder bekend is
    assert pg.input_value("#meld-wijziging-melder") == "Test"
    assert pg.evaluate("() => window.__errs") == []


def test_bug_melding_bevat_alle_kopjes_en_context(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    pg.click('#tabs button[data-view="bug"]')
    pg.locator("#meld-bug-samenvatting").wait_for()
    for k, v in [("samenvatting", "Totaal klopt niet"), ("stappen", "1. Open Maand\n2. Voeg rit toe"),
                 ("verwacht", "Totaal 20 km"), ("werkelijk", "Totaal 10 km")]:
        pg.fill("#meld-bug-%s" % k, v)
        pg.dispatch_event("#meld-bug-%s" % k, "input")
    pg.select_option("#meld-bug-frequentie", "altijd")
    pg.select_option("#meld-bug-hinder", index=1)

    assert pg.evaluate("() => window.__km.meld.onderwerp('bug')") == "[BUG] Totaal klopt niet"
    tekst = pg.evaluate("() => window.__km.meld.tekst('bug')")
    for kop in ["Type: Bug", "*Stappen om te reproduceren*", "*Verwacht resultaat*",
                "*Werkelijk resultaat*", "*Frequentie*", "*Impact*", "*Technische context"]:
        assert kop in tekst, kop
    assert "App-versie:" in tekst and "Omgeving:" in tekst and "User agent:" in tekst
    assert "1. Open Maand" in tekst
    assert pg.evaluate("() => window.__errs") == []


def test_wijziging_wordt_user_story(app):
    pg = app(storage=leeg_dossier(gelezenBerichten=GELEZEN))
    pg.click('#tabs button[data-view="wijziging"]')
    pg.locator("#meld-wijziging-samenvatting").wait_for()
    for k, v in [("samenvatting", "Rit kopieren"), ("rol", "medewerker die declareert"),
                 ("wens", "een rit kunnen dupliceren"), ("waarde", "ik niet alles opnieuw hoef in te voeren")]:
        pg.fill("#meld-wijziging-%s" % k, v)
        pg.dispatch_event("#meld-wijziging-%s" % k, "input")
    pg.select_option("#meld-wijziging-urgentie", "graag binnenkort")

    tekst = pg.evaluate("() => window.__km.meld.tekst('wijziging')")
    assert "Type: Story" in tekst
    assert ("Als medewerker die declareert wil ik een rit kunnen dupliceren "
            "zodat ik niet alles opnieuw hoef in te voeren") in tekst
    assert "*Acceptatiecriteria*" not in tekst          # leeg optioneel veld wordt weggelaten
    assert pg.evaluate("() => window.__errs") == []


def test_melding_stuurt_geen_administratiegegevens_mee(app):
    """Harde privacygarantie: een melding bevat nooit ritten, locaties of bedragen."""
    d = leeg_dossier(
        settings={"naam": "Jan Jansen", "vergoeding": 0.23},
        locaties=[{"id": "L1", "naam": "Geheime Klant BV", "straat": "Kerkstraat",
                   "huisnummer": "7", "postcode": "1234 AB", "plaats": "Zwolle", "aliassen": []}],
        maanden={YM: {"dagen": {YM + "-05": {"opmerking": "vertrouwelijk bezoek",
                 "ritten": [{"id": "r", "van": "L1", "naar": "L1", "km": 1337, "kmA": 1337}]}}}},
        gelezenBerichten=GELEZEN,
    )
    pg = app(storage=d)
    pg.click('#tabs button[data-view="bug"]')
    pg.locator("#meld-bug-samenvatting").wait_for()
    for k, v in [("samenvatting", "Iets gaat mis"), ("stappen", "openen"),
                 ("verwacht", "goed"), ("werkelijk", "fout")]:
        pg.fill("#meld-bug-%s" % k, v)
        pg.dispatch_event("#meld-bug-%s" % k, "input")
    pg.select_option("#meld-bug-frequentie", "altijd")
    pg.select_option("#meld-bug-hinder", index=1)

    tekst = pg.evaluate("() => window.__km.meld.tekst('bug')")
    for verboden in ["Geheime Klant", "Kerkstraat", "1234 AB", "Zwolle",
                     "vertrouwelijk bezoek", "0.23", "0,23", "1337"]:
        assert verboden not in tekst, "melding lekt administratiegegeven: %s" % verboden
    # de naam van de melder mag wél mee, maar alleen via het melder-veld
    assert "*Melder*" in tekst and "Jan Jansen" in tekst
