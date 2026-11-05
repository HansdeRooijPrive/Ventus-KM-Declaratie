"""Tier 5 — de koppelpunten waar de VSA-inbouwlaag op steunt.

VSA bouwt de inbouwstand zelf, als een eigen laag die bij het bouwen in onze bundel
wordt geplaatst (`00a-vsa-inbouw-voor.js` vóór de module, `19a-vsa-inbouw.js` binnen
de IIFE). De module spreekt het contract dus niet zelf; wat hij wél moet doen is deze
namen en vormen ongemoeid laten.

Deze tests zijn het directe equivalent van "past deze versie nog op het contract?".
Faalt er een, dan is dat geen bug maar een melding: laat het VSA weten vóór de release
(zie docs/vsa-koppelpunten.md). Hun km_update.py weigert zo'n bundel anders bij het
bouwen.

Bron: 'stand van zaken' van VSA, 05-11-2026, paragraaf 2.
"""
import glob
import os
import re

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _lees(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def _bundel():
    """De gebouwde app-code (zonder de vendor-bibliotheken)."""
    return "\n".join(_lees(p) for p in _app_bestanden())


def _app_bestanden():
    return sorted(glob.glob(os.path.join(ROOT, "src", "app", "*.js")))


# --------------------------------------------------------------- functies

FUNCTIES = [
    # navigatie en opbouw
    "gaNaar", "tekenMaand", "tekenOverzicht", "tekenLocaties", "vulInstellingen", "tekenOpslag",
    # data
    "migreer", "defaultData", "save", "geldigeData",
    # melding
    "toast",
    # voor de rittenimport van VSA
    "getDag", "parseAdres", "uid",
]


@pytest.mark.parametrize("naam", FUNCTIES)
def test_functie_bestaat_nog(naam):
    """De VSA-laag roept deze functies aan. Hernoemen breekt de koppeling."""
    assert re.search(r"\bfunction\s+%s\s*\(" % re.escape(naam), _bundel()), (
        "functie %s is hernoemd of weg; meld dit bij VSA vóór de release" % naam)


# --------------------------------------------------------------- variabelen

def test_D_en_bannerVerborgen_zijn_niet_const():
    """De VSA-laag overschrijft deze twee. Worden ze const, dan mislukt het laden
    bij VSA zonder melding — vandaar een harde test."""
    bundel = _bundel()
    for naam in ["D", "bannerVerborgen"]:
        assert not re.search(r"\bconst\s+%s\b" % naam, bundel), \
            "%s mag geen const zijn: de VSA-laag overschrijft hem" % naam
        assert re.search(r"\b(let|var)\s+%s\b" % naam, bundel), \
            "%s moet als let of var gedeclareerd blijven" % naam


def test_opslag_bestaat_nog():
    assert re.search(r"\b(const|let|var)\s+opslag\s*=", _bundel())


# --------------------------------------------------------------- de bouw

def test_een_iife_geopend_door_core_en_gesloten_door_boot():
    """VSA plaatst 19a-vsa-inbouw.js binnen deze IIFE; die moet dus blijven bestaan,
    met 01-core.js als opening en 20-boot.js als afsluiting."""
    bestanden = [os.path.basename(p) for p in _app_bestanden()]
    assert bestanden[0] == "00-versie.js"
    assert "01-core.js" in bestanden and bestanden[-1] == "20-boot.js", \
        "20-boot.js moet het laatste app-bestand blijven (sorted-volgorde)"
    assert _lees("src/app/01-core.js").lstrip().startswith("(function ()")
    assert _lees("src/app/20-boot.js").rstrip().endswith("})();")


def test_vsa_laag_landt_binnen_de_iife():
    """19a-vsa-inbouw.js moet in sorted()-volgorde ná 01-core en vóór 20-boot vallen."""
    namen = [os.path.basename(p) for p in _app_bestanden()] + ["19a-vsa-inbouw.js"]
    volgorde = sorted(namen)
    assert volgorde.index("01-core.js") < volgorde.index("19a-vsa-inbouw.js") < volgorde.index("20-boot.js")


# --------------------------------------------------------------- netwerk

VERBODEN_NETWERK = ["XMLHttpRequest", "sendBeacon", "EventSource", "WebSocket", "new Image("]


@pytest.mark.parametrize("vorm", VERBODEN_NETWERK)
def test_geen_netwerkverkeer_buiten_fetch_om(vorm):
    """De VSA-laag wikkelt fetch. Andere vormen gaan daar volledig langs en falen
    op productie stil; km_update.py weigert zo'n bundel."""
    assert vorm not in _bundel(), \
        "%s gaat langs de fetch-wikkel van VSA; gebruik fetch" % vorm


def test_externe_hosts_zijn_de_bekende_drie():
    """Een nieuwe externe host moet vooraf bij VSA gemeld worden, anders weigert
    km_update.py de bundel."""
    gevonden = set(re.findall(r"https://([a-z0-9.\-]+)", _bundel()))
    toegestaan = {
        "nominatim.openstreetmap.org", "router.project-osrm.org", "overpass-api.de",
        "login.microsoftonline.com", "graph.microsoft.com",      # OneDrive, losse app
        "entra.microsoft.com", "portal.azure.com",               # alleen links in uitleg
    }
    nieuw = gevonden - toegestaan
    assert not nieuw, "nieuwe externe host(s) %s: meld dit bij VSA vóór de release" % sorted(nieuw)


# --------------------------------------------------------------- locatie

def test_huidige_locatie_houdt_zijn_vorm():
    """VSA verbergt de keuze zelf en herkent hem aan deze klasse."""
    assert "combo-item huidige" in _bundel()


def test_precies_een_getCurrentPosition_en_geen_watchPosition():
    bundel = _bundel()
    assert bundel.count("getCurrentPosition") == 1, \
        "VSA rekent op precies één getCurrentPosition-aanroep"
    assert "watchPosition" not in bundel, \
        "doorlopend volgen (watchPosition) wordt door VSA niet ondersteund"


# --------------------------------------------------------------- downloads

DOWNLOAD_MELDINGEN = [
    "PDF gedownload",
    "Excel-bestand gedownload",
    "Back-up gedownload",
    "locaties geëxporteerd",
]


@pytest.mark.parametrize("melding", DOWNLOAD_MELDINGEN)
def test_downloadmelding_is_ongewijzigd(melding):
    """VSA vervangt deze vier meldingen door een eigen melding die pas verschijnt als
    de download echt gestart is. Wijzigt een tekst, dan moet VSA dat weten."""
    assert melding in _bundel(), \
        "downloadmelding %r is gewijzigd; meld dit bij VSA vóór de release" % melding


def test_geen_vijfde_downloadroute():
    """Elke nieuwe download moet bij VSA gemeld worden; de laag vangt alleen de
    bekende routes af."""
    bundel = _bundel()
    routes = len(re.findall(r"\bdoc\.save\(|\bXLSX\.writeFile\(|download\s*=", bundel))
    assert routes <= 6, (
        "er lijkt een downloadroute bijgekomen (%d gevonden); meld dit bij VSA" % routes)
