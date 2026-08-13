/* ============================================================
   Welkomstscherm bij een lege administratie
   ============================================================ */
function tekenWelkom() {
  const s = D.settings;
  if ($('#wkNaam') && document.activeElement !== $('#wkNaam')) $('#wkNaam').value = s.naam || '';
  if ($('#wkVoertuig')) $('#wkVoertuig').value = s.voertuig || 'auto';
  if ($('#wkKenteken') && document.activeElement !== $('#wkKenteken')) $('#wkKenteken').value = s.kenteken || '';
  if ($('#wkVergoeding') && document.activeElement !== $('#wkVergoeding')) $('#wkVergoeding').value = s.vergoeding;

  const thuis = locById(s.thuisId);
  const host = $('#wkThuis');
  if (host) {
    host.innerHTML = thuis
      ? '<div class="thuis-kaart"><span class="ico">🏠</span><div><div class="naam">' + esc(locNaam(thuis)) +
        '</div><div class="adres">' + esc(locAdres(thuis) || 'geen adresgegevens') + '</div></div></div>'
      : '<div class="thuis-kaart"><span class="ico">🏠</span><div class="leeg">Nog geen thuisadres ingesteld.</div></div>';
  }
  const opslag2 = $('#wkOpslag');
  if (opslag2) opslag2.innerHTML = opslagPaneelHtml();
  const st = $('#wkImportStatus');
  if (st) {
    st.textContent = D.locaties.length
      ? D.locaties.length + ' locaties en ' + Object.keys(D.afstanden).length / 2 + ' bekende afstanden aanwezig'
      : 'Nog geen locaties. Je kunt ze ook gewoon tijdens het invoeren toevoegen.';
  }
  const klaar = $('#btnWkKlaar');
  if (klaar) klaar.disabled = !(s.naam || '').trim() || !locById(s.thuisId);
}

function bindWelkom() {
  const s = () => D.settings;
  $('#wkNaam').oninput = e => { s().naam = e.target.value; save(); tekenStats(); tekenWelkom(); };
  $('#wkVoertuig').onchange = e => { s().voertuig = e.target.value; save(); };
  $('#wkKenteken').oninput = e => { s().kenteken = e.target.value; save(); };
  $('#wkVergoeding').oninput = e => { s().vergoeding = parseFloat(String(e.target.value).replace(',', '.')) || 0; save(); };
  $('#btnWkThuis').onclick = async () => {
    const bestaand = locById(s().thuisId);
    const loc = await locatieModal(bestaand);
    if (!loc) return;
    s().thuisId = loc.id;
    if (!s().stdVan) s().stdVan = loc.id;
    save(); tekenWelkom(); vulSelects(); tekenLocaties();
  };
  $('#btnWkNieuw').onclick = async () => { await kiesOpslagBestand(); tekenWelkom(); };
  $('#btnWkOpenen').onclick = async () => { await openOpslagBestand(); tekenWelkom(); };
  $('#btnWkImport').onclick = () => importModal();
  $('#btnWkKlaar').onclick = () => { D.ingericht = true; save(); gaNaar('maand'); };
  $('#btnWkOverslaan').onclick = () => { D.ingericht = true; save(); gaNaar('maand'); };
}

