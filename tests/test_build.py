"""Tier 3 — build- en integriteitstests. Zie tests/RISICOREGISTER.md."""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def test_build_check_slaagt():
    # index.html moet overeenkomen met een verse build van src/
    r = subprocess.run([sys.executable, "build.py", "--check"], cwd=ROOT)
    assert r.returncode == 0


def test_geen_appcode_in_vendor():
    # APP_VERSIE hoort in src/app/00-versie.js, niet in het vendor-bestand
    assert "APP_VERSIE" not in _read("src/vendor/20-jspdf.min.js")
    assert "APP_VERSIE" in _read("src/app/00-versie.js")


def test_prod_index_gebruikt_prod_sleutels():
    html = _read("index.html")
    # actieve productie-definities aanwezig
    assert "const STORE_KEY = 'kmdeclaratie.v1';" in html
    assert "const IDB_DB = 'kilometerdeclaratie'," in html
    assert "bestand: 'kilometerdeclaratie.json'," in html
    # test-varianten mogen niet als actieve code in productie staan
    assert "kmdeclaratie.test.v1" not in html
    assert "const IDB_DB = 'kilometerdeclaratie-test'," not in html
    assert "bestand: 'kilometerdeclaratie-test.json'," not in html


def test_omgevingen_hebben_eigen_opslag():
    # Het platform bouwt per omgeving. Test en acceptatie mogen nooit dezelfde
    # localStorage-sleutel, IndexedDB of hetzelfde OneDrive-bestand als productie gebruiken.
    sys.path.insert(0, ROOT)
    import build
    prod, acc, test = build.build("prod"), build.build("acc"), build.build("test")
    assert "const STORE_KEY = 'kmdeclaratie.v1';" in prod
    for html, omg in ((acc, "acc"), (test, "test")):
        assert "const STORE_KEY = 'kmdeclaratie.%s.v1';" % omg in html
        assert "const IDB_DB = 'kilometerdeclaratie-%s'," % omg in html
        assert "bestand: 'kilometerdeclaratie-%s.json'," % omg in html
        assert "const STORE_KEY = 'kmdeclaratie.v1';" not in html
        assert "const IDB_DB = 'kilometerdeclaratie'," not in html
        assert "bestand: 'kilometerdeclaratie.json'," not in html
    # de huidige testnamen blijven gelijk, zodat bestaande testgegevens bruikbaar blijven
    assert "kmdeclaratie.test.v1" in test and "kilometerdeclaratie-test.json" in test
    # merkkleur per omgeving (groen voor test, zoals voorheen)
    assert "--merk:#cc0000;" in prod and "--merk:#0f7a45;" in test and "--merk:#cc0000;" not in acc


def test_boot_zonder_console_fouten(app):
    pg = app()
    assert pg.evaluate("() => window.__errs") == []
    assert pg.evaluate("() => !!window.__km") is True
