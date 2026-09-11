/* ============================================================
   Start
   ============================================================ */
try { opslag.autoOpslaan = localStorage.getItem(STORE_KEY + '.auto') !== '0'; } catch (e) { /* standaard aan */ }

migreer();          // maand-tarieven vastleggen en oude schattingen opruimen
tekenVersie();
tekenNieuwsBadge();
vulInstellingen();
bindInstellingen();
bindWelkom();
tekenMaand();
tekenOverzicht();
tekenLocaties();
tekenOpslag();
odInit();                                                     // OneDrive: inlog-terugkeer afhandelen en (in OneDrive-modus) binnenhalen
if (D.settings.opslagModus !== 'onedrive') herstelOpslagbestand();

if (!opslagOk) {
  const w = document.createElement('div');
  w.style.cssText = 'background:#fdecec;border:1px solid #f0cdcd;color:#8b2c2c;padding:10px 14px;border-radius:11px;margin-bottom:14px;font-size:13.5px';
  w.textContent = 'Let op: deze browser staat geen lokale noodkopie toe. Kies bij Instellingen een opslagbestand op je ' +
    'computer, anders blijft je invoer niet bewaard.';
  $('#view-maand').prepend(w);
}

// Nog niets ingericht? Dan eerst het welkomstscherm
if (!D.ingericht && !D.locaties.length && !(D.settings.naam || '').trim()) gaNaar('welkom');

// Nieuwsberichten tonen — niet bovenop het welkomstscherm.
// In OneDrive-modus regelt odInit dit (ná laden, of overslaan als er eerst
// ingelogd moet worden), zodat nieuws niet stapelt met het inlogscherm.
if (ui.view !== 'welkom' && D.settings.opslagModus !== 'onedrive') toonBerichten();

// Open vandaag als die in de huidige maand valt
const vandaag = new Date();
if (nowYm() === ui.ym) {
  const ds = ui.ym + '-' + pad(vandaag.getDate());
  ui.open.add(ds);
  tekenDag(ds);
}

// Mobiel: bij de eerste aanraking naar fullscreen in de browser zelf, waar dat kan.
// (iOS Safari ondersteunt dit niet en negeert het; daar werkt "zet op startscherm".)
(function () {
  const el = document.documentElement;
  const staStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  const mobiel = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
  if (staStandalone || !mobiel || !el.requestFullscreen) return;
  document.addEventListener('pointerdown', function eersteTik() {
    try { const p = el.requestFullscreen(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* niet ondersteund */ }
  }, { once: true });
})();

window.__km = {
  get D() { return D; },
  save, opslag, favorieten, comboZoek, importeer: verwerkImport,
  kies: kiesOpslagBestand, openen: openOpslagBestand,
  schrijf: schrijfBestand, lees: laadUitBestand,
  nieuws: toonBerichten, berichten: BERICHTEN,
  // Testhaakje: pure functies bereikbaar maken voor de geautomatiseerde tests (tests/test_pure.py)
  fns: { afrond, haversine, locKort, locNaam, locLabel, comboZoek, dagKm, maandKm, paarAfstand,
         nominatimQuery, daysInMonth, shiftYm, ymLabel, normPostcode, parseAdres, migreer, berichtGelezen },
  koppel: async h => { opslag.handle = h; opslag.naam = h.name; opslag.negeerExtern = true; try { await idbZet(IDB_KEY, h); } catch (e) {} return schrijfBestand(); }
};
})();

