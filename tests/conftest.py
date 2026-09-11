"""
Gedeelde fixtures voor de testsuite.

Bouwt index.html uit src/, serveert de map over http://127.0.0.1 (localhost is
een secure context, nodig voor o.a. crypto.subtle), en start één headless
Chromium via Playwright. Geen Node nodig — alles draait op Python.
"""
import functools
import http.server
import json
import os
import socketserver
import subprocess
import sys
import threading

import pytest
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY = sys.executable

# Init-script dat JS-fouten opvangt zodat tests ze kunnen controleren.
_ERR_CAPTURE = (
    "window.__errs=[];"
    "window.addEventListener('error',function(e){window.__errs.push(String(e.message||e));});"
    "window.addEventListener('unhandledrejection',function(e){window.__errs.push('promise: '+String(e.reason));});"
)


@pytest.fixture(scope="session")
def base_url():
    subprocess.run([PY, "build.py"], cwd=ROOT, check=True)
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield "http://127.0.0.1:%d" % httpd.server_address[1]
    httpd.shutdown()


@pytest.fixture(scope="session")
def browser():
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


def _open(browser, base_url, storage=None, geolocation=None, viewport=None):
    kwargs = {}
    if geolocation:
        kwargs["geolocation"] = geolocation
        kwargs["permissions"] = ["geolocation"]
    if viewport:
        kwargs["viewport"] = viewport
    ctx = browser.new_context(**kwargs)
    ctx.add_init_script(_ERR_CAPTURE)
    if storage is not None:
        ctx.add_init_script("localStorage.setItem('kmdeclaratie.v1', %s)" % json.dumps(json.dumps(storage)))
    pg = ctx.new_page()
    pg.goto(base_url + "/index.html")
    pg.wait_for_function("window.__km !== undefined")
    return ctx, pg


@pytest.fixture
def page(browser, base_url):
    """Kale app-pagina (geen geseede data), voor de pure-logica-tests."""
    ctx, pg = _open(browser, base_url)
    yield pg
    ctx.close()


@pytest.fixture
def app(browser, base_url):
    """Factory: open de app met optionele geseede opslag/geolocatie/viewport."""
    ctxs = []

    def factory(storage=None, geolocation=None, viewport=None):
        ctx, pg = _open(browser, base_url, storage, geolocation, viewport)
        ctxs.append(ctx)
        return pg

    yield factory
    for c in ctxs:
        c.close()


def leeg_dossier(**over):
    """Een geldig, leeg databestand; overschrijf velden via keyword-args."""
    d = {
        "v": 1, "ingericht": True,
        "settings": {
            "naam": "Test", "voertuig": "auto", "kenteken": "", "vergoeding": 0.25,
            "thuisId": "", "afronding": "ceil", "spiegelAfstand": True, "aantalFavorieten": 8,
            "stdVan": "", "stdNaar": "", "stdRetour": True, "hideWeekend": False,
            "opslagModus": "lokaal", "odClientId": "",
        },
        "locaties": [], "maanden": {}, "afstanden": {}, "gelezenBerichten": [],
    }
    for k, v in over.items():
        if k == "settings":
            d["settings"].update(v)
        else:
            d[k] = v
    return d
