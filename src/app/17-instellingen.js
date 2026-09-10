/* ============================================================
   Instellingen
   ============================================================ */
function vulSelects() {
  const s = D.settings;
  [['#setThuis', s.thuisId], ['#setStdVan', s.stdVan], ['#setStdNaar', s.stdNaar]].forEach(([sel, id]) => {
    const el = $(sel);
    if (!el || el === combo.input) return;
    const l = id ? locById(id) : null;
    el.dataset.id = l ? l.id : '';
    el.value = l ? locLabel(l) : '';
    el.classList.toggle('leeg', !l);
  });
  tekenThuisAdres();
}

function tekenThuisAdres() {
  const host = $('#thuisAdres');
  if (!host) return;
  const l = locById(D.settings.thuisId);
  if (!l) {
    host.innerHTML = '<div class="thuis-kaart"><span class="ico">🏠</span>' +
      '<div class="leeg">Nog geen thuisadres gekozen. Zonder thuisadres werken de knoppen “Rit naar huis” en “Standaardrit” niet.</div></div>';
    return;
  }
  const adres = locAdres(l);
  host.innerHTML = '<div class="thuis-kaart"><span class="ico">🏠</span><div>' +
    '<div class="naam">' + esc(locNaam(l)) + '</div>' +
    '<div class="adres">' + esc(adres || 'geen adresgegevens ingevuld') + '</div>' +
    (l.lat ? '' : '<div class="adres" style="color:var(--amber)">nog niet opgezocht op de kaart</div>') +
    '</div><button class="btn sm" id="btnThuisBewerk">Adres bewerken</button></div>';
  $('#btnThuisBewerk').onclick = async () => {
    const gewijzigd = await locatieModal(l);
    if (gewijzigd) { tekenLocaties(); tekenMaand(); }
    vulSelects();
  };
}
function vulInstellingen() {
  const s = D.settings;
  $('#setNaam').value = s.naam || '';
  $('#setVoertuig').value = s.voertuig || 'auto';
  $('#setKenteken').value = s.kenteken || '';
  $('#setVergoeding').value = s.vergoeding;
  $('#setAfronding').value = s.afronding || 'ceil';
  $('#setAantalFav').value = s.aantalFavorieten || 8;
  $('#setSpiegel').checked = s.spiegelAfstand !== false;
  $('#locExportTeller').textContent = D.locaties.length + ' locaties · ' +
    Object.keys(D.afstanden).length / 2 + ' bekende afstanden';
  $('#setStdRetour').checked = !!s.stdRetour;
  $('#hideWeekend').checked = !!s.hideWeekend;
  $('#setAutoOpslaan').checked = opslag.autoOpslaan;
  vulSelects();
  tekenOpslag();
  odTekenStatus();
}
function bindInstellingen() {
  const s = () => D.settings;
  $('#setNaam').oninput = e => { s().naam = e.target.value; save(); tekenStats(); };
  $('#setVoertuig').onchange = e => { s().voertuig = e.target.value; save(); };
  $('#setKenteken').oninput = e => { s().kenteken = e.target.value; save(); };
  $('#setVergoeding').oninput = e => { s().vergoeding = parseFloat(String(e.target.value).replace(',', '.')) || 0; save(); tekenStats(); };
  $('#setStdRetour').onchange = e => { s().stdRetour = e.target.checked; save(); };
  $('#setAantalFav').oninput = e => {
    s().aantalFavorieten = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 8));
    save(); tekenLocaties();
  };
  $('#setAfronding').onchange = e => { s().afronding = e.target.value; save(); herberekenAfronding(); };
  $('#setSpiegel').onchange = e => {
    s().spiegelAfstand = e.target.checked;
    save();
    const n = herbepaalAlleAfstanden();
    toast(e.target.checked
      ? (n ? n + ' rit' + (n === 1 ? '' : 'ten') + ' gelijkgetrokken met de omgekeerde richting' : 'Heen en terug worden voortaan gelijk gehouden')
      : (n ? n + ' rit' + (n === 1 ? '' : 'ten') + ' terug naar de eigen richting' : 'Richtingen worden voortaan apart berekend'));
  };

  $('#odModus').onchange = async e => {
    const m = e.target.value;
    s().opslagModus = m; save(); odTekenStatus(); tekenOpslag();
    if (m === 'onedrive') {
      OD.clientId = s().odClientId || '';
      opslag.naam = 'OneDrive · ' + OD.bestand;
      if (!OD.clientId) toast('Vul je Client ID in en klik daarna op “Inloggen met Microsoft”');
      else if (await odGeldigToken()) await odTrekBinnen();
      else toast('Klik op “Inloggen met Microsoft” om te koppelen');
    } else {
      zetStatus(opslag.handle ? 'ok' : 'browser');
    }
  };
  $('#odClientId').oninput = e => { s().odClientId = e.target.value.trim(); OD.clientId = s().odClientId; save(); odTekenStatus(); };
  $('#btnOdLogin').onclick = () => odLogin();
  $('#btnOdSync').onclick = () => odTrekBinnen();
  $('#btnOdUitloggen').onclick = () => odUitloggen();
  $('#btnOdHelp').onclick = () => odToonHelp();

  $('#btnKiesBestand').onclick = kiesOpslagBestand;
  $('#btnOpenBestand').onclick = openOpslagBestand;
  $('#btnOntkoppel').onclick = ontkoppelBestand;
  $('#btnNuOpslaan').onclick = async () => {
    if (!opslag.handle) { toast('Kies eerst een opslagbestand', true); return; }
    if (await schrijfBestand()) toast('Opgeslagen in ' + opslag.naam);
  };
  $('#btnHerlaadBestand').onclick = async () => {
    if (!opslag.handle) { toast('Kies eerst een opslagbestand', true); return; }
    const ok = await bevestig('Opnieuw laden uit bestand',
      'De huidige weergave wordt vervangen door de inhoud van ' + opslag.naam + '. Niet-opgeslagen wijzigingen gaan verloren.');
    if (ok) await laadUitBestand();
  };
  $('#setAutoOpslaan').onchange = e => {
    opslag.autoOpslaan = e.target.checked;
    try { localStorage.setItem(STORE_KEY + '.auto', e.target.checked ? '1' : '0'); } catch (err) { /* optioneel */ }
    if (opslag.autoOpslaan) save();
    tekenOpslag();
  };

  $('#btnImportLoc').onclick = () => importModal();
  $('#btnExportLoc').onclick = exporteerLocaties;

  $('#btnBackup').onclick = () => {
    const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kilometerdeclaratie-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Back-up gedownload');
  };
  $('#btnRestore').onclick = () => $('#restoreFile').click();
  $('#restoreFile').onchange = e => {
    const f = e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const j = JSON.parse(fr.result);
        if (!j.settings || !j.locaties) throw new Error('ongeldig bestand');
        D = j; D.maanden = D.maanden || {}; D.afstanden = D.afstanden || {};
        save(); vulInstellingen(); tekenMaand(); tekenLocaties(); tekenOverzicht();
        toast('Back-up hersteld');
      } catch (err) { toast('Dit bestand kon niet worden gelezen', true); }
    };
    fr.readAsText(f);
    e.target.value = '';
  };
  $('#btnWipe').onclick = opnieuwBeginnen;
}

