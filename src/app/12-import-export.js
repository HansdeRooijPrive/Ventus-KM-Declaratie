/* ============================================================
   Locaties en afstanden importeren en exporteren
   ============================================================ */
function normPostcode(p) {
  const s = String(p || '').replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^(\d{4})([A-Z]{2})$/);
  return m ? m[1] + ' ' + m[2] : s;
}

/* Herkent de gangbare Nederlandse schrijfwijzen uit een adressenlijst. */
function parseAdres(tekst) {
  const s = String(tekst || '').replace(/\s+/g, ' ').trim();
  let m;
  m = s.match(/^(.+?)\s*,\s*(\d{4}\s*[A-Z]{2})\s+(.+)$/i);           // Straat 12, 1234 AB Plaats
  if (m) {
    const st = m[1].trim(), mm = st.match(/^(.*?)\s+(\d+\S*)$/);
    return { straat: mm ? mm[1].trim() : st, huisnummer: mm ? mm[2] : '', postcode: normPostcode(m[2]), plaats: m[3].trim() };
  }
  m = s.match(/^(\d{4}\s*[A-Z]{2})\s+(\d\S*)\s*,\s*(.+)$/i);          // 1234 AB 12, Plaats
  if (m) return { straat: '', huisnummer: m[2], postcode: normPostcode(m[1]), plaats: m[3].trim() };
  m = s.match(/^(\d{4}\s*[A-Z]{2})\s*,\s*(.+)$/i);                    // 1234 AB, Plaats
  if (m) return { straat: '', huisnummer: '', postcode: normPostcode(m[1]), plaats: m[2].trim() };
  m = s.match(/^(\d{4}\s*[A-Z]{2})\s+([A-Za-z].*)$/i);                // 1234 AB Plaats
  if (m) return { straat: '', huisnummer: '', postcode: normPostcode(m[1]), plaats: m[2].trim() };
  m = s.match(/^(\d{4})\s+(\d\S*)\s*,\s*(.+)$/);                      // 1234 12, Plaats
  if (m) return { straat: '', huisnummer: m[2], postcode: m[1], plaats: m[3].trim() };
  return { straat: '', huisnummer: '', postcode: '', plaats: s };
}

function adresSleutel(a) {
  return ((a.postcode || '') + '|' + (a.huisnummer || '') + '|' + (a.plaats || '')).toLowerCase();
}
function locatieIndex() {
  const ix = {};
  D.locaties.forEach(l => { ix[adresSleutel(l)] = l; });
  return ix;
}

/* Importeert een tabel met kolommen: naam van, adres van, naam naar, adres naar, km [, ... , Ja/Nee] */
function importeerTabel(tekst) {
  const scheider = tekst.indexOf('\t') >= 0 ? '\t' : (tekst.indexOf(';') >= 0 ? ';' : '\t');
  const ix = locatieIndex();
  const uitkomst = { locaties: 0, paren: 0, overgeslagen: 0 };
  for (const regel of tekst.split(/\r?\n/)) {
    if (!regel.trim()) continue;
    const k = regel.split(scheider);
    if (k.length < 5) { uitkomst.overgeslagen++; continue; }
    const km = parseFloat(String(k[4]).replace(',', '.'));
    if (!isFinite(km) || km < 0) { uitkomst.overgeslagen++; continue; }   // kopregel of onbruikbaar
    const vast = /^\s*ja\s*$/i.test(k[k.length - 1] || '');
    const ids = [];
    for (const paar of [[k[0], k[1]], [k[2], k[3]]]) {
      const naam = String(paar[0] || '').trim();
      const a = parseAdres(paar[1]);
      const sleutel = adresSleutel(a);
      let l = ix[sleutel];
      if (!l) {
        l = { id: uid(), naam: naam || locKort(a), straat: a.straat, huisnummer: a.huisnummer,
              postcode: a.postcode, plaats: a.plaats, lat: null, lon: null, vast: false, aliassen: [] };
        D.locaties.push(l); ix[sleutel] = l; uitkomst.locaties++;
      } else if (naam && naam !== l.naam && (l.aliassen || []).indexOf(naam) < 0) {
        l.aliassen = (l.aliassen || []).concat([naam]);
      }
      if (vast) l.vast = true;
      ids.push(l.id);
    }
    if (ids[0] !== ids[1]) {
      D.afstanden[ids[0] + '|' + ids[1]] = { km: km, bron: 'opgegeven' };
      D.afstanden[ids[1] + '|' + ids[0]] = { km: km, bron: 'opgegeven' };
      uitkomst.paren++;
    }
  }
  return uitkomst;
}

/* Importeert een eerder geëxporteerd JSON-bestand met locaties en afstanden. */
function importeerLocatieJson(j) {
  const ix = locatieIndex();
  const vertaal = {};
  const uitkomst = { locaties: 0, paren: 0, overgeslagen: 0 };
  for (const l of (j.locaties || [])) {
    const sleutel = adresSleutel(l);
    let bestaand = ix[sleutel];
    if (!bestaand) {
      bestaand = {
        // Altijd een nieuw, veilig id: id's uit een geïmporteerd bestand worden nooit
        // overgenomen (voorkomt scriptinjectie via een geprepareerd id). De vertaaltabel
        // hieronder zorgt dat de bijbehorende afstanden blijven kloppen.
        id: uid(),
        naam: l.naam || locKort(l), straat: l.straat || '', huisnummer: l.huisnummer || '',
        postcode: l.postcode || '', plaats: l.plaats || '', lat: l.lat || null, lon: l.lon || null,
        vast: !!l.vast, aliassen: l.aliassen || []
      };
      D.locaties.push(bestaand); ix[sleutel] = bestaand; uitkomst.locaties++;
    }
    vertaal[l.id] = bestaand.id;
  }
  let richtingen = 0;
  for (const sleutel of Object.keys(j.afstanden || {})) {
    const d = sleutel.split('|');
    const a = vertaal[d[0]], b = vertaal[d[1]];
    if (!a || !b || a === b) { uitkomst.overgeslagen++; continue; }
    D.afstanden[a + '|' + b] = j.afstanden[sleutel];
    richtingen++;
  }
  uitkomst.paren = Math.round(richtingen / 2);
  return uitkomst;
}

function verwerkImport(tekst) {
  let uitkomst;
  const kaal = tekst.trim();
  if (kaal.charAt(0) === '{') {
    let j;
    try { j = JSON.parse(kaal); } catch (e) { toast('Dit JSON-bestand kon niet worden gelezen', true); return null; }
    if (!j.locaties) { toast('Dit bestand bevat geen locaties', true); return null; }
    uitkomst = importeerLocatieJson(j);
  } else {
    uitkomst = importeerTabel(kaal);
  }
  vergeetFavorieten();
  save();
  tekenLocaties(); tekenMaand(); vulSelects(); tekenWelkom();
  return uitkomst;
}

function importModal() {
  return new Promise(res => {
    const m = openModal(
      '<header><h3>Locaties en afstanden importeren</h3></header>' +
      '<div class="body">' +
      '<p class="muted" style="margin:0;font-size:13.5px">Kies een eerder geëxporteerd JSON-bestand, of plak ' +
      'een tabel uit een spreadsheet met deze vijf kolommen:</p>' +
      '<div class="doc-tabel"><table><thead><tr><th>Naam van</th><th>Adres van</th><th>Naam naar</th>' +
      '<th>Adres naar</th><th>Km</th></tr></thead><tbody><tr><td>Thuis</td><td>1234 AB 12, Utrecht</td>' +
      '<td>Hoofdkantoor</td><td>5678 CD 3, Amersfoort</td><td>44</td></tr></tbody></table></div>' +
      '<div class="row" style="gap:8px"><button class="btn sm" data-x="bestand">Bestand kiezen…</button>' +
      '<input type="file" id="imBestand" accept=".json,.tsv,.csv,.txt" class="hidden">' +
      '<span class="muted" style="font-size:12.5px" id="imNaam"></span></div>' +
      '<div class="field"><label>Of plak de tabel hier</label>' +
      '<textarea id="imTekst" rows="7" placeholder="Thuis&#9;1234 AB 12, Utrecht&#9;Hoofdkantoor&#9;5678 CD 3, Amersfoort&#9;44" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px"></textarea></div>' +
      '<p class="muted" style="margin:0;font-size:12.5px">Kolommen gescheiden door een tab of puntkomma. ' +
      'Een kopregel wordt automatisch overgeslagen. Bestaande locaties worden herkend aan postcode, ' +
      'huisnummer en plaats, dus dubbel importeren kan geen kwaad.</p>' +
      '</div>' +
      '<footer><button class="btn" data-x="nee">Annuleren</button>' +
      '<button class="btn primary" data-x="ja">Importeren</button></footer>', () => res(null));

    const bestand = $('#imBestand', m.host);
    bestand.onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      $('#imNaam', m.host).textContent = f.name;
      const fr = new FileReader();
      fr.onload = () => { $('#imTekst', m.host).value = fr.result; };
      fr.readAsText(f);
    };
    m.host.addEventListener('click', e => {
      const b = e.target.closest('[data-x]');
      if (!b) return;
      if (b.dataset.x === 'bestand') { bestand.click(); return; }
      if (b.dataset.x === 'nee') { m.close(); res(null); return; }
      const tekst = $('#imTekst', m.host).value;
      if (!tekst.trim()) { toast('Kies een bestand of plak een tabel', true); return; }
      m.close();
      const uitkomst = verwerkImport(tekst);
      if (uitkomst) {
        toast(uitkomst.locaties + ' locaties en ' + uitkomst.paren + ' afstanden toegevoegd');
      }
      res(uitkomst);
    });
  });
}

function exporteerLocaties() {
  const inhoud = {
    soort: 'kilometerdeclaratie-locaties',
    versie: 1,
    locaties: D.locaties,
    afstanden: D.afstanden
  };
  const blob = new Blob([JSON.stringify(inhoud, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'locaties-en-afstanden.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(D.locaties.length + ' locaties geëxporteerd');
}

/* Wist de browserkopie, ontkoppelt het opslagbestand en start met een lege administratie. */
async function opnieuwBeginnen() {
  const ok = await bevestig('Opnieuw beginnen',
    'Hiermee wis je alle locaties, maanden en instellingen uit deze browser en wordt het opslagbestand ' +
    'ontkoppeld. Het bestand zelf blijft gewoon op je computer staan en kun je later weer openen.');
  if (!ok) return;
  try { localStorage.removeItem(STORE_KEY); } catch (e) { /* niet kritisch */ }
  try { await idbWis(IDB_KEY); } catch (e) { /* niet kritisch */ }
  opslag.handle = null; opslag.naam = null; opslag.laatsteSchrijf = 0;
  uitBrowserkopie = false;
  bannerVerborgen = false;
  D = defaultData();
  save();
  zetStatus('browser');
  vergeetFavorieten();
  vulInstellingen(); tekenMaand(); tekenLocaties(); tekenOverzicht(); tekenWelkom();
  gaNaar('welkom');
  toast('Je begint met een lege administratie');
}

