"""Tier 1 — pure logica via window.__km.fns. Zie tests/RISICOREGISTER.md."""


def test_afrond_per_modus(page):
    def a(mode, km):
        return page.evaluate(
            "([m,k]) => { window.__km.D.settings.afronding = m; return window.__km.fns.afrond(k); }",
            [mode, km])
    assert a("ceil", 2.1) == 3      # altijd naar boven op hele km
    assert a("ceil", 2.0) == 2
    assert a("ceil", 43.0) == 43
    assert a("round", 2.4) == 2     # rekenkundig
    assert a("round", 2.5) == 3
    assert a("none", 2.14) == 2.1   # 1 decimaal
    assert page.evaluate("() => window.__km.fns.afrond(null)") is None


def test_haversine_amsterdam_utrecht(page):
    d = page.evaluate("() => window.__km.fns.haversine({lat:52.3676,lon:4.9041},{lat:52.0907,lon:5.1214})")
    assert 30 < d < 45   # hemelsbreed ~35 km


def test_locatie_labels(page):
    r = page.evaluate("""() => { const f = window.__km.fns; return {
        labelNull: f.locLabel(null),
        naamNull:  f.locNaam(null),
        kort:      f.locKort({postcode:'1234 AB', huisnummer:'12', plaats:'Utrecht'}),
        label:     f.locLabel({naam:'Kantoor', plaats:'Rotterdam'}),
        labelSame: f.locLabel({naam:'Utrecht CS', plaats:'Utrecht'})
    }; }""")
    assert r["labelNull"] == ""          # crash-fix: geen fout op ontbrekende locatie
    assert r["naamNull"] == ""
    assert r["kort"] == "1234 AB 12, Utrecht"
    assert r["label"] == "Kantoor · Rotterdam"
    assert r["labelSame"] == "Utrecht CS"   # plaats niet dubbel tonen


def test_adres_parsing(page):
    r = page.evaluate("""() => { const f = window.__km.fns; return {
        pc: f.normPostcode('1234ab'),
        a1: f.parseAdres('Stationsplein 5, 1234 AB Amersfoort'),
        a2: f.parseAdres('1234 AB 12, Utrecht')
    }; }""")
    assert r["pc"] == "1234 AB"
    assert r["a1"] == {"straat": "Stationsplein", "huisnummer": "5", "postcode": "1234 AB", "plaats": "Amersfoort"}
    assert r["a2"] == {"straat": "", "huisnummer": "12", "postcode": "1234 AB", "plaats": "Utrecht"}


def test_paar_afstand_spiegel_en_bron(page):
    r = page.evaluate("""() => { const f = window.__km.fns, D = window.__km.D; const out = {};
        D.settings.spiegelAfstand = true;
        D.afstanden = {'a|b':{km:10,bron:'route'}, 'b|a':{km:12,bron:'opgegeven'}};
        out.bronWint = f.paarAfstand('a','b');       // opgegeven(3) > route(2) -> retour 12
        D.settings.spiegelAfstand = false;
        D.afstanden = {'a|b':{km:10,bron:'route'}};
        out.alleenHeen = f.paarAfstand('a','b');
        D.settings.spiegelAfstand = true;
        D.afstanden = {'b|a':{km:7,bron:'route'}};
        out.retour = f.paarAfstand('a','b');
        return out;
    }""")
    assert r["bronWint"] == {"km": 12, "bron": "retour"}
    assert r["alleenHeen"] == {"km": 10, "bron": "route"}
    assert r["retour"] == {"km": 7, "bron": "retour"}


def test_combo_zoek_sluit_gearchiveerd_uit(page):
    r = page.evaluate("""() => { const f = window.__km.fns, D = window.__km.D;
        D.locaties = [
            {id:'a', naam:'Alpha', plaats:'Utrecht', aliassen:[]},
            {id:'b', naam:'Beta',  plaats:'Amsterdam', aliassen:[]},
            {id:'c', naam:'Gamma', plaats:'Delft', aliassen:[], gearchiveerd:true}
        ];
        const leeg = f.comboZoek('');
        const zoek = f.comboZoek('alpha');
        return { ids: leeg.fav.concat(leeg.rest).map(l=>l.id), top: zoek.rest[0] && zoek.rest[0].id };
    }""")
    assert "c" not in r["ids"]          # gearchiveerde locatie niet aanbieden
    assert sorted(r["ids"]) == ["a", "b"]
    assert r["top"] == "a"              # naam-match bovenaan


def test_migreer_ruimt_schatting_en_default_gelezen(page):
    r = page.evaluate("""() => { const D = window.__km.D;
        delete D.gelezenBerichten;
        D.maanden = {'2026-05': {dagen: {'2026-05-01': {opmerking:'', ritten:[
            {id:'r', van:'x', naar:'y', km:12, kmA:12, bron:'schatting'}]}}}};
        D.afstanden = {'x|y': {km:12, bron:'schatting'}};
        window.__km.fns.migreer();
        return {
            kmA: D.maanden['2026-05'].dagen['2026-05-01'].ritten[0].kmA,
            bron: D.maanden['2026-05'].dagen['2026-05-01'].ritten[0].bron,
            afstandWeg: !D.afstanden['x|y'],
            gelezenArray: Array.isArray(D.gelezenBerichten)
        };
    }""")
    assert r["kmA"] is None            # schatting gewist
    assert r["bron"] is None
    assert r["afstandWeg"] is True
    assert r["gelezenArray"] is True   # nieuw veld gedefaulteerd


def test_datum_helpers(page):
    r = page.evaluate("""() => { const f = window.__km.fns; return {
        feb2024: f.daysInMonth('2024-02'),
        feb2026: f.daysInMonth('2026-02'),
        shift:   f.shiftYm('2026-12', 1),
        label:   f.ymLabel('2026-08')
    }; }""")
    assert r["feb2024"] == 29          # schrikkeljaar
    assert r["feb2026"] == 28
    assert r["shift"] == "2027-01"     # jaarwissel
    assert r["label"] == "augustus 2026"


def test_dag_en_maand_km(page):
    r = page.evaluate("""() => { const f = window.__km.fns, D = window.__km.D;
        D.maanden = {'2026-05': {dagen: {'2026-05-02': {opmerking:'', ritten:[{kmA:8},{kmA:2}]}}}};
        return {
            dag: f.dagKm({opmerking:'', ritten:[{kmA:10},{kmA:5},{kmA:null}]}),
            dagNull: f.dagKm(null),
            maand: f.maandKm('2026-05')
        };
    }""")
    assert r["dag"] == 15              # null telt als 0
    assert r["dagNull"] == 0
    assert r["maand"] == 10
