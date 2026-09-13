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

## Conventions
- Vendor libraries load in file-name order: `src/vendor/10-xlsx.min.js` before `20-jspdf.min.js`.
- Brand colours per environment in `app.json` (`theme`); the manifest's theme colour is URL-encoded,
  hence `waarden.THEMA_URL`.
- Icons: `src/icons/icon.<prod|acc|test>.png` (red / orange / green car), must differ. PNGs are binary
  in `.gitattributes` - keep that line, or Git corrupts them.
- OneDrive login uses the page URL as redirect URI. Every environment URL must be registered in the
  Microsoft Entra app registration; /acceptatie/ was new at onboarding.
