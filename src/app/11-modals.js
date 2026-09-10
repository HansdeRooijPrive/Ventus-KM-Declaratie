/* ============================================================
   Modals
   ============================================================ */
function openModal(html, bijSluiten) {
  const host = document.createElement('div');
  host.className = 'backdrop';
  host.innerHTML = '<div class="modal">' + html + '</div>';
  $('#modalHost').appendChild(host);
  host.addEventListener('mousedown', e => { if (e.target === host) { close(); if (bijSluiten) bijSluiten(); } });
  function close() { host.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') { close(); if (bijSluiten) bijSluiten(); } }
  document.addEventListener('keydown', onKey);
  return { host, close };
}

function bevestig(titel, tekst) {
  return new Promise(res => {
    const m = openModal(
      '<header><h3>' + esc(titel) + '</h3></header>' +
      '<div class="body"><p style="margin:0">' + esc(tekst) + '</p></div>' +
      '<footer><button class="btn" data-x="nee">Annuleren</button><button class="btn primary" data-x="ja">Doorgaan</button></footer>',
      () => res(false));
    m.host.addEventListener('click', e => {
      const b = e.target.closest('[data-x]');
      if (!b) return;
      m.close(); res(b.dataset.x === 'ja');
    });
  });
}

/* Keuzedialoog met meerdere knoppen; levert de key van de gekozen knop (of null). */
function keuze(titel, tekst, opties) {
  return new Promise(res => {
    const m = openModal(
      '<header><h3>' + esc(titel) + '</h3></header>' +
      '<div class="body"><p style="margin:0">' + esc(tekst) + '</p></div>' +
      '<footer>' + opties.map(o =>
        '<button class="btn' + (o.primair ? ' primary' : '') + '" data-k="' + o.k + '">' + esc(o.label) + '</button>').join('') +
      '</footer>', () => res(null));
    m.host.addEventListener('click', e => {
      const b = e.target.closest('[data-k]');
      if (!b) return;
      m.close(); res(b.dataset.k);
    });
  });
}

function locatieModal(bestaand, voorinvul) {
  return new Promise(res => {
    const l = bestaand || voorinvul || { id: null, naam: '', straat: '', huisnummer: '', postcode: '', plaats: '' };
    const m = openModal(
      '<header><h3>' + (bestaand ? 'Locatie bewerken' : 'Nieuwe locatie') + '</h3></header>' +
      '<div class="body">' +
      '<div class="field"><label>Adres zoeken</label>' +
      '<input type="text" id="lmZoek" placeholder="bijv. 1234 AB 12 Utrecht of Stationsplein 5 Amersfoort" autocomplete="off"></div>' +
      '<div class="suggest hidden" id="lmSug"></div>' +
      '<div class="field"><label>Naam van de locatie</label><input type="text" id="lmNaam" value="' + esc(l.naam) + '" placeholder="bijv. Thuis of Kantoor Rotterdam"></div>' +
      '<div class="grid2">' +
      '<div class="field"><label>Straat</label><input type="text" id="lmStraat" value="' + esc(l.straat) + '"></div>' +
      '<div class="field"><label>Huisnummer</label><input type="text" id="lmNr" value="' + esc(l.huisnummer) + '"></div>' +
      '<div class="field"><label>Postcode</label><input type="text" id="lmPc" value="' + esc(l.postcode) + '" placeholder="1234 AB"></div>' +
      '<div class="field"><label>Plaats</label><input type="text" id="lmPlaats" value="' + esc(l.plaats) + '"></div>' +
      '</div>' +
      '<label class="row" style="gap:7px;font-size:13.5px;cursor:pointer"><input type="checkbox" id="lmFav" style="width:auto"' +
      (l.vast ? ' checked' : '') + '> Altijd bovenaan vastzetten (los van het gebruik)</label>' +
      '<p class="muted" style="margin:0;font-size:12.5px">Het adres wordt automatisch opgezocht zodra je het voor het eerst in een rit gebruikt.</p>' +
      '</div>' +
      '<footer><button class="btn" data-x="nee">Annuleren</button><button class="btn primary" data-x="ja">Opslaan</button></footer>');

    const zoek = $('#lmZoek', m.host), sug = $('#lmSug', m.host);
    let t = null, coords = { lat: l.lat, lon: l.lon };
    zoek.addEventListener('input', () => {
      clearTimeout(t);
      const q = zoek.value.trim();
      if (q.length < 4) { sug.classList.add('hidden'); return; }
      t = setTimeout(async () => {
        sug.classList.remove('hidden');
        sug.innerHTML = '<div class="empty">Zoeken…</div>';
        try {
          const r = await zoekAdres(q);
          if (!r.length) { sug.innerHTML = '<div class="empty">Geen resultaten</div>'; return; }
          sug.innerHTML = r.map((x, i) => '<div data-i="' + i + '">' + esc(x.display_name) + '</div>').join('');
          sug.onclick = e => {
            const d = e.target.closest('[data-i]');
            if (!d) return;
            const x = r[+d.dataset.i], a = x.address || {};
            $('#lmStraat', m.host).value = a.road || '';
            $('#lmNr', m.host).value = a.house_number || '';
            $('#lmPc', m.host).value = a.postcode || '';
            $('#lmPlaats', m.host).value = a.city || a.town || a.village || a.municipality || '';
            if (!$('#lmNaam', m.host).value)
              $('#lmNaam', m.host).value = (a.city || a.town || a.village || '') || (x.name || '');
            coords = { lat: parseFloat(x.lat), lon: parseFloat(x.lon) };
            sug.classList.add('hidden');
          };
        } catch (err) { sug.innerHTML = '<div class="empty">Zoeken mislukt (geen internet?)</div>'; }
      }, 550);
    });

    m.host.addEventListener('click', async e => {
      const b = e.target.closest('[data-x]');
      if (!b) return;
      if (b.dataset.x === 'nee') { m.close(); res(null); return; }
      const naam = $('#lmNaam', m.host).value.trim();
      const straat = $('#lmStraat', m.host).value.trim();
      const nr = $('#lmNr', m.host).value.trim();
      const pc = $('#lmPc', m.host).value.trim().toUpperCase();
      const plaats = $('#lmPlaats', m.host).value.trim();
      const fav = $('#lmFav', m.host).checked;
      if (!plaats && !pc && !straat) { toast('Vul minimaal een adres of postcode in', true); return; }
      let obj;
      if (bestaand) {
        obj = bestaand;
        // Alleen postcode, huisnummer en plaats bepalen wáár een locatie ligt; een straatnaam
        // aanvullen is een verduidelijking en mag de bekende afstanden niet weggooien.
        const sleutel = o => normaliseer((o.postcode || '') + '|' + (o.huisnummer || '') + '|' + (o.plaats || ''));
        const verplaatst = sleutel(obj) !== sleutel({ postcode: pc, huisnummer: nr, plaats });
        const bekend = verplaatst ? bekendeAfstanden(obj.id) : 0;
        let wissen = verplaatst;
        if (bekend) {
          const k = await keuze('Adres gewijzigd',
            'Deze locatie krijgt een ander adres. Er ' + (bekend === 1 ? 'is 1 bekende afstand' : 'zijn ' + bekend + ' bekende afstanden') +
            ' naar deze locatie opgeslagen. Wil je die opnieuw laten berekenen?',
            [{ k: 'wis', label: 'Opnieuw berekenen', primair: true }, { k: 'houd', label: 'Afstanden behouden' }, { k: 'nee', label: 'Annuleren' }]);
          if (!k || k === 'nee') return;
          wissen = k === 'wis';
        }
        Object.assign(obj, { naam: naam || locKort({ postcode: pc, huisnummer: nr, plaats }), straat, huisnummer: nr, postcode: pc, plaats, vast: fav });
        if (wissen) { obj.lat = coords.lat || null; obj.lon = coords.lon || null; wisAfstandenVan(obj.id); }
        else if (coords.lat) { obj.lat = coords.lat; obj.lon = coords.lon; }
      } else {
        obj = { id: uid(), naam: naam || locKort({ postcode: pc, huisnummer: nr, plaats }), straat, huisnummer: nr, postcode: pc, plaats, lat: coords.lat || null, lon: coords.lon || null, vast: fav, aliassen: [] };
        D.locaties.push(obj);
      }
      save(); m.close(); res(obj);
    });
    setTimeout(() => zoek.focus(), 40);
  });
}

function wisAfstandenVan(id) {
  for (const k of Object.keys(D.afstanden)) if (k.split('|').includes(id)) delete D.afstanden[k];
}

/* ============================================================
   Versie-informatie
   ============================================================ */
const SOORT_LABEL = { klein: 'kleine wijziging', middel: 'middelgrote wijziging', groot: 'grote wijziging' };

function tekenVersie() {
  const v = (typeof APP_VERSIE !== 'undefined') ? APP_VERSIE : null;
  if (!v) return;
  const datum = d => {
    const p = String(d || '').split('-');
    return p.length === 3 ? (+p[2]) + ' ' + MAANDEN[+p[1] - 1] + ' ' + p[0] : (d || '');
  };
  $('#versieChip').textContent = 'v' + v.versie;
  $('#overVersie').textContent = 'versie ' + v.versie;
  $('#overDatum').textContent = datum(v.datum);
  $('#overHistorie').innerHTML = (v.historie || []).map((h, i) =>
    '<div class="wijziging' + (i === 0 ? ' nu' : '') + '">' +
    '<div class="v">' + esc(h.versie) + '</div>' +
    '<div class="t">' + esc(h.tekst) +
    '<div class="meta">' + datum(h.datum) + ' · ' + (SOORT_LABEL[h.soort] || h.soort) + '</div></div></div>').join('');
  if (v.regels) {
    $('#overRegels').textContent = 'Versieregel: kleine wijziging ' + v.regels.klein +
      ', middelgrote wijziging ' + v.regels.middel + ', grote wijziging ' + v.regels.groot + '.';
  }
}
$('#versieChip').onclick = () => gaNaar('over');

