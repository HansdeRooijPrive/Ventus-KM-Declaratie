/* ============================================================
   Locaties
   ============================================================ */
function locGebruik() {
  const g = {};
  for (const ym of Object.keys(D.maanden))
    for (const ds of Object.keys(D.maanden[ym].dagen))
      for (const r of D.maanden[ym].dagen[ds].ritten) {
        if (r.van) g[r.van] = (g[r.van] || 0) + 1;
        if (r.naar) g[r.naar] = (g[r.naar] || 0) + 1;
      }
  return g;
}
function bekendeAfstanden(id) {
  return Object.keys(D.afstanden).filter(k => k.split('|')[0] === id).length;
}
const selectie = new Set();      // ids van aangevinkte locaties
let zichtbareIds = [];           // ids die nu in de lijst staan (na zoeken en filteren)

function zichtbareLocaties() {
  const q = ($('#locZoek') ? $('#locZoek').value : '').trim().toLowerCase();
  const filter = $('#locFilter') ? $('#locFilter').value : 'alle';
  const gebruik = locGebruik();
  let lijst = D.locaties.slice();
  if (q) lijst = lijst.filter(l =>
    (l.naam + ' ' + locAdres(l) + ' ' + (l.aliassen || []).join(' ')).toLowerCase().includes(q));
  if (filter === 'favoriet') lijst = lijst.filter(l => isFavoriet(l.id));
  if (filter === 'gebruikt') lijst = lijst.filter(l => gebruik[l.id]);
  if (filter === 'ongebruikt') lijst = lijst.filter(l => !gebruik[l.id]);
  lijst.sort((a, b) =>
    (a.gearchiveerd ? 1 : 0) - (b.gearchiveerd ? 1 : 0) ||
    (isFavoriet(b.id) ? 1 : 0) - (isFavoriet(a.id) ? 1 : 0) ||
    favTelling(b.id) - favTelling(a.id) ||
    (gebruik[b.id] || 0) - (gebruik[a.id] || 0) ||
    locNaam(a).localeCompare(locNaam(b), 'nl'));
  return { lijst, gebruik, q, filter };
}

function mv(n, enkel, meer) { return n + ' ' + (n === 1 ? enkel : meer); }

function tekenSelectiebalk(gebruik) {
  const balk = $('#locBalk');
  if (!selectie.size) { balk.innerHTML = ''; return; }
  const ids = [...selectie];
  const inGebruik = ids.filter(id => gebruik[id]).length;
  const alleZichtbaarGekozen = zichtbareIds.length && zichtbareIds.every(id => selectie.has(id));
  balk.innerHTML = '<div class="sel-balk">' +
    '<span class="aantal">' + selectie.size + ' geselecteerd</span>' +
    (inGebruik ? '<span class="badge amber">' + inGebruik + ' in gebruik</span>' : '<span class="badge">geen in gebruik</span>') +
    '<button class="btn sm" data-act="alle">' + (alleZichtbaarGekozen ? 'Zichtbare deselecteren' : 'Alle zichtbare selecteren (' + zichtbareIds.length + ')') + '</button>' +
    '<button class="btn sm ghost" data-act="geen">Selectie wissen</button>' +
    '<div class="grow"></div>' +
    '<button class="btn sm danger" data-act="verwijder">' + mv(selectie.size, 'locatie', 'locaties') + ' verwijderen</button>' +
    '</div>';
}

function tekenLocaties() {
  const host = $('#locList');
  if (!D.locaties.length) {
    host.innerHTML = '<div class="empty-state"><div class="big">📍</div>Nog geen locaties. Voeg je eerste locatie toe.</div>';
    $('#locTeller').textContent = '';
    $('#locBalk').innerHTML = '';
    return;
  }
  const { lijst, gebruik, q, filter } = zichtbareLocaties();
  zichtbareIds = lijst.map(l => l.id);

  $('#locTeller').textContent = (q || filter !== 'alle')
    ? lijst.length + ' van ' + D.locaties.length + ' locaties'
    : D.locaties.length + ' locaties · ' + Object.keys(D.afstanden).length / 2 + ' bekende afstanden';

  tekenSelectiebalk(gebruik);

  if (!lijst.length) {
    host.innerHTML = '<div class="empty-state"><div class="big">🔍</div>Geen locatie gevonden met deze zoekopdracht of dit filter.</div>';
    return;
  }
  host.innerHTML = lijst.map(l => {
    const arch = !!l.gearchiveerd;
    const badges = arch
      ? ' <span class="badge grijs">gearchiveerd</span>'
      : (isFavoriet(l.id) && !l.vast ? ' <span class="badge green">favoriet</span>' : '') +
        (l.id === D.settings.thuisId ? ' <span class="badge blue">standaard</span>' : '');
    const acts = arch
      ? '<button class="btn sm" data-act="edit">Bewerken</button>' +
        '<button class="btn sm ghost" data-act="herstel">Herstellen</button>' +
        '<div class="grow"></div><button class="btn sm ghost" data-act="del" title="Definitief verwijderen">🗑</button>'
      : '<button class="btn sm" data-act="edit">Bewerken</button>' +
        '<button class="btn sm ghost" data-act="thuis">Als standaard</button>' +
        '<div class="grow"></div><button class="btn sm ghost" data-act="del" title="Verwijderen">🗑</button>';
    return '<div class="loc' + (selectie.has(l.id) ? ' gekozen' : '') + (arch ? ' gearchiveerd' : '') + '" data-id="' + esc(l.id) + '">' +
      '<div class="n">' +
      '<input type="checkbox" class="loc-sel" data-act="sel"' + (selectie.has(l.id) ? ' checked' : '') + (arch ? ' disabled' : '') + ' title="Selecteren">' +
      '<button class="star' + (l.vast ? ' on' : '') + '" data-act="fav"' + (arch ? ' disabled' : '') + ' title="' +
      (l.vast ? 'Vastgezet bovenaan — klik om los te maken' : 'Altijd bovenaan vastzetten') + '">' +
      (l.vast ? '📌' : '☆') + '</button><span>' + esc(l.naam || locKort(l)) + '</span>' + badges + '</div>' +
      '<div class="a">' + esc(locAdres(l) || '—') + '</div>' +
      '<div class="a muted" style="font-size:12px">' +
      (favTelling(l.id) ? favTelling(l.id) + '× in 6 mnd' : (gebruik[l.id] ? gebruik[l.id] + '× gebruikt' : 'nog niet gebruikt')) +
      ' · ' + bekendeAfstanden(l.id) + ' bekende afstanden</div>' +
      '<div class="acts">' + acts + '</div>' +
      '</div>';
  }).join('');
}

/* Verwijdert of archiveert een groep locaties.
   Een locatie die in ritten voorkomt bevat administratie-data en wordt daarom
   niet weggegooid maar gearchiveerd (blijft zichtbaar in bestaande ritten en
   via locById, maar verdwijnt uit de keuzelijsten). Alleen echt ongebruikte
   locaties — of expliciet met forceer=true — worden definitief verwijderd. */
function verwijderLocaties(ids, forceer) {
  const set = new Set(ids);
  const gebruik = locGebruik();
  const teArchiveren = forceer ? [] : ids.filter(id => gebruik[id]);
  const teVerwijderen = forceer ? ids.slice() : ids.filter(id => !gebruik[id]);
  const del = new Set(teVerwijderen);

  teArchiveren.forEach(id => { const l = locById(id); if (l) { l.gearchiveerd = true; l.vast = false; } });

  D.locaties = D.locaties.filter(l => !del.has(l.id));
  for (const k of Object.keys(D.afstanden)) {
    const d = k.split('|');
    if (del.has(d[0]) || del.has(d[1])) delete D.afstanden[k];
  }
  // Instellingen die naar een verwijderde of gearchiveerde locatie wijzen, bijwerken.
  const s = D.settings, actief = D.locaties.filter(l => !l.gearchiveerd);
  if (set.has(s.thuisId)) s.thuisId = actief.length ? actief[0].id : '';
  if (set.has(s.stdVan)) s.stdVan = s.thuisId;
  if (set.has(s.stdNaar)) s.stdNaar = '';
  ids.forEach(id => selectie.delete(id));
  save(); tekenLocaties(); tekenMaand(); vulSelects();
  return { gearchiveerd: teArchiveren.length, verwijderd: teVerwijderen.length };
}

async function verwijderSelectie() {
  const ids = [...selectie].filter(id => locById(id) && !locById(id).gearchiveerd);
  if (!ids.length) return;
  const gebruik = locGebruik();
  const inGebruik = ids.filter(id => gebruik[id]);
  const ongebruikt = ids.filter(id => !gebruik[id]);

  let bericht;
  if (!inGebruik.length) {
    bericht = mv(ids.length, 'locatie wordt', 'locaties worden') + ' verwijderd, samen met de bekende afstanden ervan. ' +
      (ids.length === 1 ? 'Deze locatie komt' : 'Geen van deze locaties komt') + ' voor in een rit.';
  } else {
    bericht = (inGebruik.length === 1 ? 'Eén geselecteerde locatie komt' : inGebruik.length + ' geselecteerde locaties komen') +
      ' voor in ritten en ' + (inGebruik.length === 1 ? 'wordt gearchiveerd' : 'worden gearchiveerd') +
      ': ze blijven zichtbaar in die ritten en herstelbaar, maar verdwijnen uit de keuzelijsten.' +
      (ongebruikt.length ? ' De overige ' + mv(ongebruikt.length, 'locatie', 'locaties') + ' ' +
        (ongebruikt.length === 1 ? 'wordt' : 'worden') + ' definitief verwijderd.' : '');
  }
  const ok = await bevestig('Locaties verwijderen', bericht);
  if (!ok) return;
  const r = verwijderLocaties(ids);
  const delen = [];
  if (r.gearchiveerd) delen.push(mv(r.gearchiveerd, 'locatie gearchiveerd', 'locaties gearchiveerd'));
  if (r.verwijderd) delen.push(mv(r.verwijderd, 'locatie verwijderd', 'locaties verwijderd'));
  toast(delen.join(' · ') || 'Klaar');
}

$('#locBalk').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'alle') {
    const alles = zichtbareIds.every(id => selectie.has(id));
    zichtbareIds.forEach(id => alles ? selectie.delete(id) : selectie.add(id));
    tekenLocaties();
  }
  if (a === 'geen') { selectie.clear(); tekenLocaties(); }
  if (a === 'verwijder') verwijderSelectie();
});

$('#locList').addEventListener('click', async ev => {
  const btn = ev.target.closest('[data-act]');
  if (!btn) return;
  const id = btn.closest('.loc').dataset.id;
  const loc = locById(id);
  const act = btn.dataset.act;
  if (act === 'sel') {
    // Alleen deze kaart en de balk bijwerken: de lijst opnieuw opbouwen zou de scrollpositie verliezen
    if (selectie.has(id)) selectie.delete(id); else selectie.add(id);
    const kaart = btn.closest('.loc');
    kaart.classList.toggle('gekozen', selectie.has(id));
    btn.checked = selectie.has(id);
    tekenSelectiebalk(locGebruik());
    return;
  }
  if (act === 'fav') {
    loc.vast = !loc.vast;
    save(); tekenLocaties(); tekenMaand(); vulSelects();
    toast(loc.vast ? locNaam(loc) + ' staat nu altijd bovenaan' : locNaam(loc) + ' volgt weer het gebruik');
  }
  if (act === 'edit') { await locatieModal(loc); tekenLocaties(); tekenMaand(); vulSelects(); }
  if (act === 'thuis') { D.settings.thuisId = id; save(); tekenLocaties(); vulSelects(); toast('Standaard vertrekpunt ingesteld'); }
  if (act === 'herstel') {
    loc.gearchiveerd = false;
    save(); tekenLocaties(); tekenMaand(); vulSelects();
    toast('“' + locNaam(loc) + '” hersteld');
  }
  if (act === 'del') {
    const g = locGebruik()[id] || 0;
    if (loc.gearchiveerd) {
      const ok = await bevestig('Definitief verwijderen',
        '“' + locNaam(loc) + '” is gearchiveerd. Definitief verwijderen kan niet ongedaan worden gemaakt' +
        (g ? ', en de ' + mv(g, 'rit', 'ritten') + ' met deze locatie tonen daarna “onbekend”.' : '.'));
      if (!ok) return;
      verwijderLocaties([id], true);
      toast('Locatie definitief verwijderd');
      return;
    }
    const ok = await bevestig('Locatie verwijderen',
      g ? '“' + locNaam(loc) + '” komt voor in ' + mv(g, 'rit', 'ritten') + '. De locatie wordt gearchiveerd: hij verdwijnt uit de keuzelijsten, maar blijft zichtbaar in die ritten en je kunt hem later herstellen.'
        : 'Weet je zeker dat je “' + locNaam(loc) + '” wilt verwijderen? Deze locatie komt niet voor in een rit.');
    if (!ok) return;
    const r = verwijderLocaties([id]);
    toast(r.gearchiveerd ? 'Locatie gearchiveerd' : 'Locatie verwijderd');
  }
});
$('#btnAddLoc').onclick = async () => { await locatieModal(null); tekenLocaties(); vulSelects(); };
$('#locZoek').oninput = () => tekenLocaties();
$('#locFilter').onchange = () => tekenLocaties();

