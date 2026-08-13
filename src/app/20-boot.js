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

// Nieuwsberichten tonen — niet bovenop het welkomstscherm
if (ui.view !== 'welkom') toonBerichten();

// Open vandaag als die in de huidige maand valt
const vandaag = new Date();
if (nowYm() === ui.ym) {
  const ds = ui.ym + '-' + pad(vandaag.getDate());
  ui.open.add(ds);
  tekenDag(ds);
}

window.__km = {
  get D() { return D; },
  save, opslag, favorieten, comboZoek, importeer: verwerkImport,
  kies: kiesOpslagBestand, openen: openOpslagBestand,
  schrijf: schrijfBestand, lees: laadUitBestand,
  nieuws: toonBerichten, berichten: BERICHTEN,
  koppel: async h => { opslag.handle = h; opslag.naam = h.name; opslag.negeerExtern = true; try { await idbZet(IDB_KEY, h); } catch (e) {} return schrijfBestand(); }
};
})();

