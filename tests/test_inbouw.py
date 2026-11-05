"""Tier 4 — de inbouwstand en het contract met de Ventus Slimme Assistent.

Draait tegen tests/vsa-sim.html, een nabootsing van het portaal. Zie
docs/vsa-inbouwcontract-v1-reactie.md en tests/RISICOREGISTER.md.

De scenario's volgen de acceptatielijst uit voorstel G van dat document: elk
scenario waarin een medewerker gegevens zou kunnen kwijtraken, heeft hier een test.
"""
import datetime
import time

import pytest
from conftest import leeg_dossier

YM = datetime.date.today().strftime("%Y-%m")


def dossier_met_rit():
    return leeg_dossier(
        locaties=[{"id": "L1", "naam": "Kantoor", "plaats": "Utrecht", "aliassen": []},
                  {"id": "L2", "naam": "Klant", "plaats": "Zwolle", "aliassen": []}],
        maanden={YM: {"dagen": {YM + "-05": {"opmerking": "", "ritten": [
            {"id": "r1", "van": "L1", "naar": "L2", "km": 42, "kmA": 42, "handmatig": True}]}},
            "vergoeding": 0.23, "naam": "Jan Jansen", "kenteken": "AB-123-C", "voertuig": "auto"}},
    )


@pytest.fixture
def vsa(browser, base_url):
    """Opent de nabootsing van het portaal met de module erin."""
    ctxs = []

    def factory(doc=None, locatie=False, laden_vertraging=0, auto_laden=True, zoek="", wacht=True):
        ctx = browser.new_context()
        ctx.add_init_script(
            "window.addEventListener('error',function(e){(window.__errs=window.__errs||[]).push(String(e.message||e));});")
        ctxs.append(ctx)
        pg = ctx.new_page()
        pg.goto(base_url + "/tests/vsa-sim.html")
        pg.wait_for_function("window.__vsa !== undefined")
        pg.evaluate(
            """([doc, loc, vert, auto]) => {
                __vsa.doc = doc; __vsa.locatie = loc;
                __vsa.ladenVertraging = vert; __vsa.autoLaden = auto;
            }""", [doc, locatie, laden_vertraging, auto_laden])
        pg.evaluate("z => __vsa.start(z)", zoek)
        if wacht:
            pg.wait_for_function("__vsa.aantal('gereed') > 0", timeout=8000)
        return pg

    yield factory
    for c in ctxs:
        c.close()


def mod(pg):
    """De module in het kader."""
    return pg.frame_locator("#kader")


def km(pg, expr):
    """Evalueer iets binnen de module."""
    return pg.frame(url=lambda u: "inbouw=vsa" in u).evaluate(expr)


def wacht_geladen(pg, timeout=10000):
    """Wacht tot het eerste laden is verwerkt.

    Niet op '.day' wachten: de maandweergave tekent ook dagen voor een lege
    administratie, dus die verschijnt al vóór het laden binnen is.
    """
    pg.frame(url=lambda u: "inbouw=vsa" in u).wait_for_function(
        "() => window.__km && window.__km.inbouw.stand.geladen", timeout=timeout)


# ---------------------------------------------------------------- contract

def test_gereed_draagt_contract_en_versies(vsa):
    pg = vsa(doc=dossier_met_rit())
    g = pg.evaluate("() => __vsa.laatste('gereed')")
    assert g["km"] == 1 and g["contract"] == 1
    assert g["dataVersie"] == 1
    assert g["appVersie"]                      # de module meldt zijn eigen versie


def test_laden_vult_de_administratie(vsa):
    pg = vsa(doc=dossier_met_rit())
    pg.wait_for_function("__vsa.aantal('view') > 0 || true")
    wacht_geladen(pg)
    assert km(pg, "() => window.__km.D.locaties.length") == 2
    assert km(pg, "() => window.__km.D.settings.opslagModus") == "extern"
    assert km(pg, "() => window.__errs || []") == []


def test_scenario2_laden_met_null_start_leeg(vsa):
    """Acceptatiescenario 2: data null -> lege administratie, geen fout."""
    pg = vsa(doc=None)
    wacht_geladen(pg)
    assert km(pg, "() => window.__km.D.locaties.length") == 0
    assert km(pg, "() => window.__km.D.maanden && typeof window.__km.D.maanden") == "object"
    assert km(pg, "() => window.__errs || []") == []


def test_geen_browseropslag_in_de_inbouwstand(vsa):
    """Het kader deelt localStorage met het portaal; daar mag niets van de administratie in."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    km(pg, "() => { window.__km.D.settings.kenteken = 'ZZ-999-Z'; window.__km.save(); }")
    pg.wait_for_function("__vsa.aantal('bewaren') > 0", timeout=8000)
    sleutels = km(pg, "() => Object.keys(localStorage)")
    assert [s for s in sleutels if "kmdeclaratie" in s] == []


def test_onbekende_berichten_worden_genegeerd(vsa):
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    voor = km(pg, "() => JSON.stringify(window.__km.D)")
    pg.evaluate("""() => {
        __vsa.stuur({ type: 'zwaaien' });                 // onbekend type
        document.getElementById('kader').contentWindow.postMessage({ type: 'laden', data: null }, location.origin);
    }""")   # tweede bericht mist km:1
    pg.wait_for_timeout(300)
    assert km(pg, "() => JSON.stringify(window.__km.D)") == voor
    assert km(pg, "() => window.__errs || []") == []


# ---------------------------------------------------------------- navigatie

def test_ga_en_view_lopen_gelijk(vsa):
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    pg.evaluate("() => __vsa.stuur({ type: 'ga', view: 'overzicht' })")
    pg.wait_for_function("(__vsa.laatste('view')||{}).view === 'overzicht'", timeout=8000)
    assert km(pg, "() => window.__km.D && document.querySelector('#view-overzicht').classList.contains('active')")

    aantal = pg.evaluate("() => __vsa.aantal('view')")
    pg.evaluate("() => __vsa.stuur({ type: 'ga', view: 'handleiding' })")   # niet toegestaan
    pg.wait_for_timeout(250)
    assert pg.evaluate("() => __vsa.aantal('view')") == aantal              # geen wissel, geen melding


# ---------------------------------------------------------------- weergave

def test_eigen_zijbalk_en_hulp_zijn_weg(vsa):
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    for sel in [".zijbalk", "#view-handleiding", "#view-nieuws", "#view-over",
                "#view-wijziging", "#view-bug", "#opslagKaart", "#odKaart", "#installKaart"]:
        assert mod(pg).locator(sel).count() == 1, sel          # blijft in de DOM
        assert not mod(pg).locator(sel).is_visible(), sel      # maar is niet zichtbaar
    assert km(pg, "() => document.documentElement.classList.contains('km-inbouw')")


def test_huidige_locatie_volgt_de_vlag(vsa):
    """Standaard uit; alleen zichtbaar als het portaal locatie:true meestuurt."""
    pg = vsa(doc=dossier_met_rit(), locatie=False)
    wacht_geladen(pg)
    assert km(pg, "() => window.__km.inbouw.stand.locatie") is False
    assert km(pg, """() => {
        const d = document.querySelector('.day-head'); if (d) d.click();
        const i = document.querySelector('input.combo-input'); if (!i) return 'geen veld';
        i.click();
        return document.querySelectorAll('#comboPaneel .combo-item.huidige').length;
    }""") in (0, "geen veld")

    pg2 = vsa(doc=dossier_met_rit(), locatie=True)
    wacht_geladen(pg2)
    assert km(pg2, "() => window.__km.inbouw.stand.locatie") is True


def test_geo_parameter_stuurt_de_kaartdiensten_om(vsa):
    pg = vsa(doc=dossier_met_rit(), zoek="&geo=/portaal/api/km/geo")
    wacht_geladen(pg)
    g = km(pg, "() => window.__km.inbouw.geo")
    bases = [g["nominatim"], g["osrm"], g["overpass"]]
    assert bases == ["/portaal/api/km/geo/nominatim",
                     "/portaal/api/km/geo/osrm",
                     "/portaal/api/km/geo/overpass"]


# ---------------------------------------------------------------- opslag

def test_bewaren_gaat_direct_en_zonder_vertraging(vsa):
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    km(pg, "() => { window.__km.D.settings.kenteken = 'XX-111-X'; window.__km.save(); }")
    pg.wait_for_function("__vsa.aantal('bewaren') > 0", timeout=3000)
    b = pg.evaluate("() => __vsa.laatste('bewaren')")
    assert b["bron"] == "bewerking"
    assert b["data"]["settings"]["kenteken"] == "XX-111-X"
    pg.wait_for_function("__vsa.doc !== null", timeout=5000)


def test_scenario5_fout_laat_de_gegevens_staan(vsa):
    """Acceptatiescenario 5: melding zichtbaar, gegevens blijven in beeld."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    pg.evaluate("() => { __vsa.antwoord = 'fout'; }")
    km(pg, "() => { window.__km.D.settings.kenteken = 'FOUT-1'; window.__km.save(); }")
    pg.wait_for_function("__vsa.aantal('bewaren') > 0", timeout=5000)
    pg.wait_for_timeout(400)
    assert km(pg, "() => window.__km.D.settings.kenteken") == "FOUT-1"   # niet teruggedraaid
    assert km(pg, "() => window.__km.opslag.status") == "fout"
    assert km(pg, "() => window.__km.opslag.melding") != ""


def test_scenario6_te_groot_geeft_een_uitweg(vsa):
    """Acceptatiescenario 6: herkenbare melding met uitweg, niet 'probeer opnieuw'."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    pg.evaluate("() => { __vsa.antwoord = 'te-groot'; }")
    km(pg, "() => { window.__km.D.settings.kenteken = 'GROOT-1'; window.__km.save(); }")
    mod(pg).locator("#modalHost .backdrop .modal").wait_for(timeout=8000)
    tekst = mod(pg).locator("#modalHost .backdrop .modal").inner_text()
    assert "te groot" in tekst.lower()
    assert "exporteer" in tekst.lower()                 # er staat een uitweg in
    assert km(pg, "() => window.__km.D.settings.kenteken") == "GROOT-1"


def test_scenario3_conflict_andere_versie_laden(vsa):
    """Acceptatiescenario 3 en 7: elders gewijzigd -> andere versie laden."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    # Ander apparaat slaat op; daarna wijzigt deze gebruiker
    anders = dossier_met_rit()
    anders["settings"]["kenteken"] = "ANDER-1"
    pg.evaluate("d => { __vsa.doc = d; __vsa.elders(); }", anders)
    km(pg, "() => { window.__km.D.settings.kenteken = 'MIJN-1'; window.__km.save(); }")
    mod(pg).locator("#modalHost .backdrop .modal").wait_for(timeout=8000)
    mod(pg).locator('#modalHost .backdrop .modal [data-k="laden"]').click()
    pg.wait_for_function("__vsa.aantal('herladen') > 0", timeout=8000)
    pg.wait_for_function("""() => {
        const f = document.getElementById('kader');
        return true;
    }""")
    # na het herladen staat de andere versie in beeld
    for _ in range(40):
        if km(pg, "() => window.__km.D.settings.kenteken") == "ANDER-1":
            break
        time.sleep(0.1)
    assert km(pg, "() => window.__km.D.settings.kenteken") == "ANDER-1"


def test_scenario4_conflict_mijn_versie_opslaan(vsa):
    """Acceptatiescenario 4: eigen versie wint, met het versienummer uit het conflict."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    pg.evaluate("() => __vsa.elders()")
    km(pg, "() => { window.__km.D.settings.kenteken = 'MIJN-2'; window.__km.save(); }")
    mod(pg).locator("#modalHost .backdrop .modal").wait_for(timeout=8000)
    conflict = pg.evaluate("() => __vsa.versie")
    mod(pg).locator('#modalHost .backdrop .modal [data-k="forceer"]').click()
    pg.wait_for_function("__vsa.doc && __vsa.doc.settings.kenteken === 'MIJN-2'", timeout=8000)
    # de module stuurde precies het versienummer uit het conflict terug
    bewaren = pg.evaluate("() => __vsa.log.filter(b => b.type === 'bewaren')")
    assert bewaren[-1]["versie"] == conflict


def test_scenario1_traag_laden_blokkeert_de_invoer(vsa):
    """Acceptatiescenario 1: niets kunnen typen tot de administratie binnen is."""
    pg = vsa(doc=dossier_met_rit(), laden_vertraging=1200)
    # zolang er geen laden is, ligt er een grendel over het scherm
    assert mod(pg).locator("#inbouwGrendel").count() == 1
    assert km(pg, "() => window.__km.inbouw.stand.geladen") is False
    wacht_geladen(pg)
    assert mod(pg).locator("#inbouwGrendel").count() == 0
    assert km(pg, "() => window.__km.inbouw.stand.geladen") is True


def test_laat_laden_zonder_verzoek_wordt_genegeerd(vsa):
    """Een laden dat niet op gereed of herladen volgt, mag nooit werk overschrijven."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    km(pg, "() => { window.__km.D.settings.kenteken = 'WERK-1'; }")
    laat = dossier_met_rit()
    laat["settings"]["kenteken"] = "LAAT-1"
    pg.evaluate("d => __vsa.stuur({ type: 'laden', data: d, versie: 99 })", laat)
    pg.wait_for_timeout(400)
    assert km(pg, "() => window.__km.D.settings.kenteken") == "WERK-1"


def test_scenario9_export_werkt_in_het_kader(vsa, browser, base_url):
    """Acceptatiescenario 9: PDF en Excel leveren een bestand op binnen het kader."""
    ctx = browser.new_context(accept_downloads=True)
    pg = ctx.new_page()
    pg.goto(base_url + "/tests/vsa-sim.html")
    pg.wait_for_function("window.__vsa !== undefined")
    pg.evaluate("d => { __vsa.doc = d; __vsa.start(''); }", dossier_met_rit())
    pg.wait_for_function("__vsa.aantal('gereed') > 0", timeout=8000)   # kader is op
    fr = pg.frame_locator("#kader")
    wacht_geladen(pg)
    pg.evaluate("() => __vsa.stuur({ type: 'ga', view: 'overzicht' })")
    fr.locator("#btnExportPdf").wait_for(timeout=8000)
    for knop in ["#btnExportPdf", "#btnExportXls"]:
        with pg.expect_download(timeout=10000) as dl:
            fr.locator(knop).click()
        assert dl.value.suggested_filename
    ctx.close()


def test_geen_verwijzingen_naar_eigen_opslag_in_het_kader(vsa):
    """Het portaal bewaart; de module mag niet over bestanden, OneDrive of
    'alleen in deze browser' beginnen. Die teksten horen bij de losse app."""
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    zichtbaar = km(pg, "() => document.body.innerText")
    for verboden in ["opslagbestand", "OneDrive", "alleen in deze browser",
                     "Bestaand bestand openen", "Nieuw bestand maken"]:
        assert verboden.lower() not in zichtbaar.lower(), verboden
    assert not mod(pg).locator("#opslagBanner").is_visible()


def test_opslaghint_volgt_het_portaal(vsa):
    pg = vsa(doc=dossier_met_rit())
    wacht_geladen(pg)
    assert km(pg, "() => (document.getElementById('saveHint')||{}).textContent") == "Opgeslagen"
    pg.evaluate("() => { __vsa.antwoord = 'fout'; }")
    km(pg, "() => { window.__km.D.settings.kenteken = 'H-1'; window.__km.save(); }")
    pg.wait_for_function("__vsa.aantal('bewaren') > 0", timeout=5000)
    pg.wait_for_timeout(300)
    assert km(pg, "() => (document.getElementById('saveHint')||{}).textContent") == "Opslaan mislukt"
