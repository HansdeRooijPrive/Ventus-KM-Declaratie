(function () {
'use strict';

/* ============================================================
   Constanten
   ============================================================ */
const STORE_KEY = 'kmdeclaratie.v1';
const WEEKDAGEN = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const MAANDEN = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const SNELLE_OPMERKINGEN = ['Thuiswerken','Vakantie','Verlof','Ziek','Feestdag'];
const NEW_LOC = '__new__';
const HUIDIGE_LOC = '__gps__';

/* ============================================================
   Opslag
   ============================================================ */
function uid() { return Math.random().toString(36).slice(2, 10); }

/* De app start volledig leeg: er staan geen persoonlijke gegevens, locaties of
   afstanden in de code. Iedere gebruiker vult zijn eigen administratie. */
function defaultData() {
  return {
    v: 1,
    ingericht: false,
    settings: {
      naam: '',
      voertuig: 'auto',
      kenteken: '',
      vergoeding: 0.25,
      thuisId: '',
      afronding: 'ceil',
      spiegelAfstand: true,
      aantalFavorieten: 8,
      stdVan: '',
      stdNaar: '',
      stdRetour: true,
      hideWeekend: false,
      opslagModus: 'lokaal',   // 'lokaal' (dit apparaat) of 'onedrive' (meerdere apparaten)
      odClientId: ''           // Microsoft Client ID uit de eigen Azure app-registratie
    },
    locaties: [],
    maanden: {},
    afstanden: {},
    gelezenBerichten: []
  };
}

let D;
let uitBrowserkopie = false;      // gegevens komen uit de noodkopie van de browser, niet uit een bestand
try {
  const raw = localStorage.getItem(STORE_KEY);
  D = raw ? JSON.parse(raw) : defaultData();
  uitBrowserkopie = !!raw;
} catch (e) { D = defaultData(); }
if (!D.settings) D = defaultData();
D.maanden = D.maanden || {};
D.afstanden = D.afstanden || {};
D.locaties = D.locaties || [];

// Controleer of opslag in deze browser beschikbaar is
let opslagOk = true;
try { localStorage.setItem(STORE_KEY + '.test', '1'); localStorage.removeItem(STORE_KEY + '.test'); }
catch (e) { opslagOk = false; }

/* Opslagstatus: de gekozen bestandslocatie is leidend, de browser houdt een noodkopie. */
const opslag = {
  handle: null,      // FileSystemFileHandle van het door de gebruiker gekozen bestand
  naam: null,
  status: 'browser', // browser | verbinden | ok | bezig | fout | geweigerd
  melding: '',
  laatsteSchrijf: 0,
  laatsteLees: 0,
  bezig: false,
  wachtend: false,
  negeerExtern: false,
  autoOpslaan: true
};
const heeftBestandsAPI = typeof window.showSaveFilePicker === 'function';

let cacheTimer = null, bestandTimer = null;
function save() {
  try { D.appVersie = APP_VERSIE.versie; } catch (e) { /* versie is optioneel */ }
  vergeetFavorieten();
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); }
    catch (e) { if (!opslag.handle) toast('Opslaan in de browser mislukt: opslag vol of geblokkeerd', true); }
  }, 150);
  if (opslag.handle && opslag.autoOpslaan) {
    clearTimeout(bestandTimer);
    bestandTimer = setTimeout(() => schrijfBestand(), 700);
  }
  if (D.settings.opslagModus === 'onedrive' && opslag.autoOpslaan) {
    clearTimeout(odTimer);
    odTimer = setTimeout(() => odDuw(true), 900);
  }
  tekenSaveHint();
}
function tekenSaveHint() {
  const h = document.getElementById('saveHint');
  if (!h) return;
  h.textContent = opslag.handle
    ? (opslag.status === 'ok' ? 'Opgeslagen in ' + opslag.naam : 'Wijziging nog niet weggeschreven')
    : 'Alleen in deze browser opgeslagen';
}

