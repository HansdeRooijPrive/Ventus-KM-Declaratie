# Ventus Kilometerdeclaratie (Ventus-KM-Declaratie)

Ventus app on the OTAP platform (onboarded 2026-09-13, functionally unchanged). CI/CD and the
build come from `HansdeRooijPrive/OTAP-CI@v2`; `build.py` here is only a thin wrapper.

## Working method (OTAP)
- Work on `development` (T, /test/). Promote to `acceptatie` (A, /acceptatie/) only after green CI,
  as a fast-forward: `git push origin development:acceptatie`.
- **Release gate:** `main` (production, /) only after the user's explicit approval in chat.
- `python build.py`, `python build.py --check`, `pytest` before every commit.

## Data safety - never break this
Users keep their real kilometre administration in the browser. Production names must stay exactly:
`localStorage` key `kmdeclaratie.v1` (+ `.auto`, `.od.token`, `.od.etag`, `.od.pkce`),
IndexedDB `kilometerdeclaratie`, OneDrive file `kilometerdeclaratie.json`.
They come from placeholders: `{{STORAGE_KEY}}.v1` and `kilometerdeclaratie{{OMG_SUFFIX}}`, with
`app.json` -> `storage_key: "kmdeclaratie"` and `waarden.OMG_SUFFIX` = "" / "-acc" / "-test".
Test keeps its historic names (`kmdeclaratie.test.v1`, `-test`); acceptatie uses `.acc` / `-acc`.
`tests/test_build.py` guards this - keep those tests.

## Embedded mode (`?inbouw=vsa`)
The module can run inside a frame in the Ventus Slimme Assistent portal. Contract and the agreed
changes: `docs/vsa-inbouwcontract-v1-reactie.md` (v1.1). Implementation: `src/app/22-inbouw.js`,
detection in `01-core.js` (`INBOUW_AAN`), hiding via `.km-inbouw` in `styles.css`.
- In this mode the module stores **nothing** itself: no `localStorage`, no file, no OneDrive.
  `save()` sends `bewaren` to the parent at once; the portal does the merging and pacing.
- Input stays blocked until the first `laden` arrives, so a slow portal cannot overwrite typed work.
- Map services go through `?geo=<basis>`; Overpass only runs when the portal sends `locatie: true`.
- `tests/vsa-sim.html` mimics the portal; `tests/test_inbouw.py` runs the agreed acceptance
  scenarios against it. Keep those tests - they guard the cases where a user loses data.
- Still open on the portal side: `allow-downloads` on the frame (otherwise export fails silently),
  and a pruning mechanism for old years. Phase 2 (not built): contract points 4 and 7.

## Conventions
- Vendor libraries load in file-name order: `src/vendor/10-xlsx.min.js` before `20-jspdf.min.js`.
- Brand colours per environment in `app.json` (`theme`); the manifest's theme colour is URL-encoded,
  hence `waarden.THEMA_URL`.
- Icons: `src/icons/icon.<prod|acc|test>.png` (red / orange / green car), must differ. PNGs are binary
  in `.gitattributes` - keep that line, or Git corrupts them.
- OneDrive login uses the page URL as redirect URI. Every environment URL must be registered in the
  Microsoft Entra app registration; /acceptatie/ was new at onboarding.
