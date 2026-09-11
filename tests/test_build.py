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
    assert "APP_VERSIE" not in _read("src/vendor/jspdf.min.js")
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


def test_deploy_isolatie_sed_patronen_matchen():
    # Repliceert de sed-transformatie van de deploy en controleert dat de
    # testbuild écht andere opslagsleutels krijgt (anders delen test en prod data).
    html = _read("index.html")
    vervang = {
        "--merk:#cc0000;": "--merk:#0f7a45;",
        "const STORE_KEY = 'kmdeclaratie.v1';": "const STORE_KEY = 'kmdeclaratie.test.v1';",
        "const IDB_DB = 'kilometerdeclaratie',": "const IDB_DB = 'kilometerdeclaratie-test',",
        "bestand: 'kilometerdeclaratie.json',": "bestand: 'kilometerdeclaratie-test.json',",
    }
    for oud in vervang:
        assert oud in html, "sed-patroon niet gevonden in index.html: %r" % oud
    testbuild = html
    for oud, nieuw in vervang.items():
        testbuild = testbuild.replace(oud, nieuw)
    assert "kmdeclaratie.test.v1" in testbuild
    assert "kilometerdeclaratie-test.json" in testbuild
    assert "#0f7a45" in testbuild


def test_boot_zonder_console_fouten(app):
    pg = app()
    assert pg.evaluate("() => window.__errs") == []
    assert pg.evaluate("() => !!window.__km") is True
