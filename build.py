#!/usr/bin/env python3
"""
Bouwt de bronbestanden in src/ tot één self-contained index.html.

De app blijft bewust één bestand (werkt offline, is als bijlage te mailen,
en de deploy draait er sed-transformaties op). Deze build voegt daarom bij
het uitrollen alles weer samen:

    src/index.template.html   HTML-romp met {{STYLES}} en {{SCRIPT}}
    src/styles.css            de opmaak
    src/vendor/*.js           ingesloten libraries (xlsx, jsPDF) — niet bewerken
    src/app/NN-*.js           de app-code, fragmenten van één IIFE, op volgorde

Gebruik:
    python build.py            -> (her)bouwt index.html
    python build.py --check    -> faalt als index.html niet overeenkomt met src/
"""
import os
import sys
import glob

ROOT = os.path.dirname(os.path.abspath(__file__))

# Vendor-libs: volgorde vastgelegd (xlsx vóór jsPDF).
VENDOR = ["src/vendor/xlsx.min.js", "src/vendor/jspdf.min.js"]


def _read(rel):
    with open(os.path.join(ROOT, rel), "rb") as f:
        return f.read()


def build():
    # App-modules op alfabetische (= numerieke 01,02,…) volgorde: dat is de leesvolgorde binnen de IIFE.
    app = sorted(glob.glob(os.path.join(ROOT, "src", "app", "*.js")))
    script = b"".join(_read(v) for v in VENDOR) + b"".join(open(p, "rb").read() for p in app)
    template = _read("src/index.template.html")
    return template.replace(b"{{STYLES}}", _read("src/styles.css")).replace(b"{{SCRIPT}}", script)


def main():
    html = build()
    out = os.path.join(ROOT, "index.html")
    if "--check" in sys.argv:
        current = _read("index.html") if os.path.exists(out) else b""
        if current == html:
            print("OK: index.html komt overeen met src/")
            return 0
        print("FOUT: index.html is verouderd — draai `python build.py` en commit het resultaat.",
              file=sys.stderr)
        return 1
    with open(out, "wb") as f:
        f.write(html)
    print(f"index.html gebouwd ({len(html)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
