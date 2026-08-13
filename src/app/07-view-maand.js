/* ============================================================
   UI-state
   ============================================================ */
const ui = { view: 'maand', ym: nowYm(), open: new Set() };

/* ============================================================
   Rendering: maandweergave
   ============================================================ */
function tekenStats() {
  const km = maandKm(ui.ym);
  const rate = Number(maandInstellingen(ui.ym).vergoeding) || 0;
  const dagen = maandDagen(ui.ym).filter(d => dagKm(d.data) > 0).length;
  $('#stKm').textContent = km.toLocaleString('nl-NL');
  if (document.activeElement !== $('#stRate')) $('#stRate').value = rate.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  $('#stTotal').textContent = eur(km * rate);
  $('#stDays').textContent = dagen;
  $('#monthLabel').textContent = ymLabel(ui.ym);
  $('#brandSub').textContent = D.settings.naam || 'rittenadministratie';
}

/* Laat per rit zien waar het aantal kilometers vandaan komt. */
const BRON_TEKST = {
  opgegeven: { kort: 'tabel', uitleg: 'Overgenomen uit je eigen afstandentabel.' },
  route: { kort: 'route', uitleg: 'Berekende route over de weg via OpenStreetMap.' },
  schatting: { kort: '≈ schatting', uitleg: 'Hemelsbrede afstand × 1,32; de route kon niet worden opgehaald.' },
  retour: { kort: 'retour', uitleg: 'Gelijkgetrokken met dezelfde rit in omgekeerde richting.' },
  gelijk: { kort: 'zelfde plek', uitleg: 'Vertrekpunt en bestemming zijn dezelfde locatie.' },
  handmatig: { kort: 'handmatig', uitleg: 'Zelf ingevuld; wordt niet automatisch herberekend.' }
};
function bronLabel(r, verbergen) {
  if (verbergen || r.bezig) return '';
  const sleutel = r.handmatig ? 'handmatig' : r.bron;
  const t = BRON_TEKST[sleutel];
  if (!t) return '';
  return '<span class="bron bron-' + esc(sleutel) + '" title="' + esc(t.uitleg) + '">' + esc(t.kort) + '</span>';
}

function ritHtml(r, i, ds) {
  const disabledVan = i > 0;
  let kmCell;
  if (r.bezig) {
    kmCell = '<span class="spin"></span>';
  } else {
    kmCell = '<input class="km-val" data-act="km" data-i="' + i + '" value="' + (r.kmA == null ? '' : r.kmA) + '" inputmode="decimal">' +
      '<span class="km-unit">km</span>';
  }
  kmCell = '<div class="km-rij">' + kmCell + '</div>';
  const onvolledig = !r.van || !r.naar;
  const geenAfstand = !onvolledig && !r.bezig && r.kmA == null;
  const bron = bronLabel(r, onvolledig || geenAfstand);

  let note = '';
  if (r.handmatig) note = '<div class="trip-note">handmatig ingevoerd · <a href="#" data-act="auto" data-i="' + i + '">opnieuw berekenen</a></div>';
  if (onvolledig) {
    note = '<div class="trip-note rood">' + (!r.van && !r.naar ? 'vertrekpunt en bestemming ontbreken'
      : (!r.van ? 'vertrekpunt ontbreekt' : 'bestemming ontbreekt')) + '</div>';
  } else if (geenAfstand) {
    const schuldigen = (r.foutLocaties || []).filter(id => locById(id));
    note = '<div class="trip-note rood">Afstand niet te bepalen: ' + esc(r.fout || 'onbekende oorzaak') +
      (schuldigen.length ? schuldigen.map(id =>
        ' · <a href="#" data-act="fixloc" data-loc="' + esc(id) + '">adres van ' + esc(locNaam(locById(id))) + ' aanvullen</a>').join('') : '') +
      ' · <a href="#" data-act="auto" data-i="' + i + '">opnieuw proberen</a></div>';
  }
  const vanVeld = disabledVan
    ? '<input type="text" class="combo-input" disabled value="' + esc(r.van ? locLabel(locById(r.van)) : '') + '">'
    : comboVeld({ combo: 'rit', ds: ds, i: i, veld: 'van' }, r.van, 'Vertrekpunt');
  const sleepbaar = i > 0;
  return '<div class="trip' + (r.bezig ? ' calc' : '') + (onvolledig || geenAfstand ? ' rood' : '') +
    (sleepbaar ? ' sleepbaar' : '') + '" data-i="' + i + '"' + (sleepbaar ? ' draggable="true"' : '') + '>' +
    '<div class="idx' + (sleepbaar ? ' greep' : '') + '"' +
    (sleepbaar ? ' title="Sleep om deze rit te verplaatsen"' : ' title="De eerste rit blijft bovenaan"') +
    '>' + (i + 1) + '</div>' +
    '<div class="van">' + vanVeld + '</div>' +
    '<div class="arrow">→</div>' +
    '<div class="naar">' + comboVeld({ combo: 'rit', ds: ds, i: i, veld: 'naar' }, r.naar, 'Bestemming') + '</div>' +
    '<div class="km-cell">' + kmCell + bron + '</div>' +
    '<button class="btn icon ghost del" data-act="deltrip" data-i="' + i + '" title="Rit verwijderen">✕</button>' +
    note +
    '</div>';
}

/* Controles per dag:
   1. een rit waarin vertrekpunt of bestemming ontbreekt (of waarvan de afstand onbekend is) — rood
   2. de dag eindigt niet op het thuisadres — oranje */
function dagControle(dag) {
  const ritten = dag ? dag.ritten : [];
  const onvolledig = [], geenAfstand = [];
  ritten.forEach((r, i) => {
    if (!r.van || !r.naar) onvolledig.push(i);
    else if (!r.bezig && r.kmA == null) geenAfstand.push(i);
  });
  const laatste = ritten.length ? ritten[ritten.length - 1] : null;
  const thuisId = D.settings.thuisId;
  const nietThuis = !!(laatste && laatste.naar && thuisId && locById(thuisId) && laatste.naar !== thuisId);
  return { onvolledig: onvolledig, geenAfstand: geenAfstand, nietThuis: nietThuis };
}

/* Knop die de dag afsluit met een rit terug naar het thuisadres. */
function naarHuisKnop(ritten) {
  const thuis = locById(D.settings.thuisId);
  if (!thuis || !ritten.length) return '';
  const laatste = ritten[ritten.length - 1];
  if (!laatste.naar) return '';
  if (laatste.naar === thuis.id) {
    return '<button class="btn sm" data-act="naarhuis" disabled title="De laatste rit eindigt al bij ' +
      esc(locNaam(thuis)) + '">🏠 Rit naar huis</button>';
  }
  return '<button class="btn sm" data-act="naarhuis" title="Voegt een rit toe van ' +
    esc(locNaam(locById(laatste.naar)) || 'de laatste bestemming') + ' naar ' + esc(locNaam(thuis)) + '">🏠 Rit naar huis</button>';
}

function dagHtml(d) {
  const dag = d.data;
  const km = dagKm(dag);
  const open = ui.open.has(d.ds);
  const opm = dag && dag.opmerking ? dag.opmerking : '';
  const ritten = dag ? dag.ritten : [];

  const ctrl = dagControle(dag);

  let samenvatting = '';
  if (ritten.length) {
    const stukken = [];
    stukken.push('<span' + (ritten[0].van ? '' : ' class="ontbreekt"') + '>' +
      esc(locNaam(locById(ritten[0].van)) || 'onbekend') + '</span>');
    ritten.forEach((r, i) => {
      let kl = '';
      if (!r.naar) kl = 'ontbreekt';
      else if (i === ritten.length - 1 && ctrl.nietThuis) kl = 'oranje';
      stukken.push('<span' + (kl ? ' class="' + kl + '"' : '') + '>' +
        esc(locNaam(locById(r.naar)) || 'onbekend') + '</span>');
    });
    samenvatting = stukken.join(' <span class="pijl">→</span> ');
  } else if (opm) samenvatting = esc(opm);
  else samenvatting = '<span class="muted">geen ritten</span>';

  let head = '<div class="day-head" data-act="toggle">' +
    '<span class="chev">▶</span>' +
    '<div class="day-date"><span class="d">' + pad(d.dag) + '/' + ui.ym.split('-')[1] + '</span>' +
    '<span class="w">' + WEEKDAGEN[d.dow] + '</span></div>' +
    (opm ? '<span class="badge amber">' + esc(opm) + '</span>' : '') +
    (ctrl.onvolledig.length ? '<span class="badge rood">' + mv(ctrl.onvolledig.length, 'rit onvolledig', 'ritten onvolledig') + '</span>' : '') +
    (ctrl.geenAfstand.length ? '<span class="badge rood">afstand onbekend</span>' : '') +
    (ctrl.nietThuis ? '<span class="badge amber">eindigt niet thuis</span>' : '') +
    '<div class="day-summary">' + samenvatting + '</div>' +
    '<div class="day-km">' + (km ? km : '–') + (km ? '<small>km</small>' : '') + '</div>' +
    '</div>';

  let body = '';
  if (open) {
    const chips = SNELLE_OPMERKINGEN.map(c =>
      '<button class="chip' + (opm === c ? ' on' : '') + '" data-act="chip" data-val="' + esc(c) + '">' + esc(c) + '</button>').join('');
    body = '<div class="day-body">' +
      '<div class="remark-row">' +
      '<div class="field"><label>Opmerking</label><input type="text" data-act="remark" value="' + esc(opm) + '" placeholder="bijv. Thuiswerken"></div>' +
      '<div class="chips">' + chips + '</div>' +
      '</div>' +
      '<div class="trips">' + ritten.map((r, i) => ritHtml(r, i, d.ds)).join('') + '</div>' +
      '<div class="day-actions">' +
      '<button class="btn sm primary" data-act="addtrip">+ Rit toevoegen</button>' +
      naarHuisKnop(ritten) +
      '<button class="btn sm" data-act="std">Standaardrit</button>' +
      '<button class="btn sm" data-act="copyprev">Vorige rijdag kopiëren</button>' +
      '<div class="grow"></div>' +
      (ritten.length ? '<button class="btn sm ghost" data-act="clear">Dag leegmaken</button>' : '') +
      '</div>' +
      '</div>';
  }
  const status = ctrl.onvolledig.length || ctrl.geenAfstand.length ? ' fout' : (ctrl.nietThuis ? ' let-op' : '');
  return '<div class="day' + (d.weekend ? ' weekend' : '') + (km ? ' has-km' : '') + (open ? ' open' : '') +
    status + '" data-ds="' + d.ds + '">' + head + body + '</div>';
}

function tekenMaand() {
  const lijst = $('#dayList');
  const dagen = maandDagen(ui.ym).filter(d => !(D.settings.hideWeekend && d.weekend && !dagKm(d.data) && !(d.data && d.data.opmerking)));
  lijst.innerHTML = dagen.map(dagHtml).join('');
  tekenStats();
}

function tekenDag(ds) {
  const el = $('.day[data-ds="' + ds + '"]');
  if (!el) return;
  const [y, m, dd] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, dd);
  const d = { ds, dag: dd, dow: dt.getDay(), weekend: dt.getDay() === 0 || dt.getDay() === 6, data: getDag(ui.ym, ds) };
  const tmp = document.createElement('div');
  tmp.innerHTML = dagHtml(d);
  el.replaceWith(tmp.firstElementChild);
}

/* ============================================================
   Interactie: dagenlijst
   ============================================================ */
function dagVan(el) {
  const wrap = el.closest('.day');
  return wrap ? wrap.dataset.ds : null;
}

$('#dayList').addEventListener('click', async ev => {
  const ds = dagVan(ev.target);
  if (!ds) return;
  const actEl = ev.target.closest('[data-act]');
  if (!actEl) return;
  const act = actEl.dataset.act;
  const i = actEl.dataset.i != null ? +actEl.dataset.i : null;

  if (act === 'toggle') {
    if (ui.open.has(ds)) ui.open.delete(ds); else ui.open.add(ds);
    tekenDag(ds);
    return;
  }
  const dag = getDag(ui.ym, ds, true);

  if (act === 'addtrip') {
    const laatste = dag.ritten[dag.ritten.length - 1];
    const van = laatste ? (laatste.naar || '') : (D.settings.thuisId || '');
    dag.ritten.push({ id: uid(), van, naar: '', km: null, kmA: null });
    save(); tekenDag(ds);
    const sel = $('.day[data-ds="' + ds + '"] .trip:last-of-type select[data-act="naar"]');
    if (sel) sel.focus();
    return;
  }
  if (act === 'deltrip') {
    dag.ritten.splice(i, 1);
    normaliseerKeten(dag); save(); tekenDag(ds); tekenStats();
    await berekenDag(ui.ym, ds);
    return;
  }
  if (act === 'naarhuis') {
    const thuis = D.settings.thuisId;
    if (!thuis || !locById(thuis)) { toast('Stel eerst een thuisadres in bij Instellingen', true); return; }
    const laatste = dag.ritten[dag.ritten.length - 1];
    if (!laatste || !laatste.naar) { toast('Vul eerst de bestemming van de vorige rit in', true); return; }
    if (laatste.naar === thuis) { toast('De laatste rit eindigt al thuis'); return; }
    dag.ritten.push({ id: uid(), van: laatste.naar, naar: thuis, km: null, kmA: null });
    normaliseerKeten(dag); save(); tekenDag(ds);
    await berekenDag(ui.ym, ds);
    return;
  }
  if (act === 'std') {
    const s = D.settings;
    if (!s.stdVan || !s.stdNaar) { toast('Stel eerst een standaardrit in bij Instellingen', true); return; }
    dag.ritten.push({ id: uid(), van: s.stdVan, naar: s.stdNaar, km: null, kmA: null });
    if (s.stdRetour) dag.ritten.push({ id: uid(), van: s.stdNaar, naar: s.stdVan, km: null, kmA: null });
    normaliseerKeten(dag); save(); tekenDag(ds);
    await berekenDag(ui.ym, ds);
    return;
  }
  if (act === 'copyprev') {
    const alle = maandDagen(ui.ym);
    const idx = alle.findIndex(x => x.ds === ds);
    let bron = null;
    for (let k = idx - 1; k >= 0; k--) if (alle[k].data && alle[k].data.ritten.length) { bron = alle[k].data; break; }
    if (!bron) { toast('Geen eerdere dag met ritten in deze maand', true); return; }
    dag.ritten = bron.ritten.map(r => ({ id: uid(), van: r.van, naar: r.naar, km: r.km, kmA: r.kmA, bron: r.bron, handmatig: r.handmatig, _voor: r._voor }));
    save(); tekenDag(ds); tekenStats();
    await berekenDag(ui.ym, ds);
    return;
  }
  if (act === 'clear') {
    dag.ritten = []; save(); tekenDag(ds); tekenStats();
    return;
  }
  if (act === 'chip') {
    const val = actEl.dataset.val;
    dag.opmerking = dag.opmerking === val ? '' : val;
    save(); tekenDag(ds);
    return;
  }
  if (act === 'fixloc') {
    ev.preventDefault();
    const loc = locById(actEl.dataset.loc);
    if (!loc) return;
    await locatieModal(loc);
    tekenLocaties(); vulSelects();
    dag.ritten.forEach(r => { if (r.bron === 'fout') { r._voor = null; r.km = null; } });
    save(); await berekenDag(ui.ym, ds);
    return;
  }
  if (act === 'auto') {
    ev.preventDefault();
    const r = dag.ritten[i];
    r.handmatig = false; r._voor = null; r.km = null;
    const key = r.van + '|' + r.naar;
    delete D.afstanden[key];
    save(); await berekenDag(ui.ym, ds);
    return;
  }
});

$('#dayList').addEventListener('change', async ev => {
  const ds = dagVan(ev.target);
  if (!ds) return;
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act, i = +el.dataset.i;
  const dag = getDag(ui.ym, ds, true);

  if (act === 'km') {
    const rit = dag.ritten[i];
    const ruw = String(el.value).trim();
    if (ruw === '') {                       // leeggemaakt: afstand weer onbepaald
      rit.km = null; rit.kmA = null; rit.handmatig = false; rit.bron = null; rit._voor = null;
      save(); tekenDag(ds); tekenStats(); return;
    }
    const v = parseFloat(ruw.replace(',', '.'));
    if (isNaN(v) || v < 0) {                 // ongeldig of negatief: weigeren en herstellen
      toast('Vul een geldig aantal kilometers in (0 of hoger)', true);
      tekenDag(ds);
      return;
    }
    const heel = Math.ceil(v - 1e-9);        // handmatige km altijd naar boven op hele kilometers
    rit.km = heel; rit.kmA = heel; rit.handmatig = true; rit.bron = 'handmatig'; rit._voor = null;
    save(); tekenDag(ds); tekenStats();
  }
});

/* ============================================================
   Ritten verslepen (de eerste rit blijft bovenaan)
   ============================================================ */
const versleep = { el: null, ds: null, container: null, pointer: null };

function sleepRijen() {
  return Array.from(versleep.container.querySelectorAll('.trip'));
}

$('#dayList').addEventListener('pointerdown', ev => {
  const greep = ev.target.closest('.idx.greep');
  if (!greep || ev.button > 0) return;
  const trip = greep.closest('.trip');
  const dagEl = trip.closest('.day');
  versleep.el = trip;
  versleep.ds = dagEl.dataset.ds;
  versleep.container = trip.parentElement;
  versleep.pointer = ev.pointerId;
  versleep.begin = sleepRijen().map(el => el.dataset.i);
  trip.classList.add('sleept');
  versleep.container.classList.add('sleep-actief');
  try { greep.setPointerCapture(ev.pointerId); } catch (e) { /* niet kritisch */ }
  ev.preventDefault();
});

$('#dayList').addEventListener('pointermove', ev => {
  if (!versleep.el || ev.pointerId !== versleep.pointer) return;
  const rijen = sleepRijen();
  const anderen = rijen.filter(el => el !== versleep.el);
  const y = ev.clientY;
  // eerste rij die ónder de cursor hoort te komen
  const na = anderen.find(el => {
    const r = el.getBoundingClientRect();
    return y < r.top + r.height / 2;
  });
  if (na) {
    if (anderen.indexOf(na) === 0) return;          // niets mag boven rit 1 komen
    if (na !== versleep.el.nextSibling) versleep.container.insertBefore(versleep.el, na);
  } else if (versleep.el !== versleep.container.lastElementChild) {
    versleep.container.appendChild(versleep.el);
  }
  // nummers meteen laten meelopen met de nieuwe volgorde
  sleepRijen().forEach((el, i) => { const b = el.querySelector('.idx'); if (b) b.textContent = i + 1; });
});

async function sleepAfronden() {
  if (!versleep.el) return;
  const el = versleep.el, ds = versleep.ds, container = versleep.container, begin = versleep.begin;
  versleep.el = null; versleep.pointer = null;
  el.classList.remove('sleept');
  container.classList.remove('sleep-actief');

  const volgorde = Array.from(container.querySelectorAll('.trip')).map(x => +x.dataset.i);
  if (volgorde.join() === begin.join()) return;      // niets verschoven

  const dag = getDag(ui.ym, ds, true);
  const oudeVan = dag.ritten.map(r => r.van);
  dag.ritten = volgorde.map(i => dag.ritten[i]);
  normaliseerKeten(dag);
  // een handmatig ingevoerde afstand hoort bij een specifiek traject: opnieuw laten berekenen
  dag.ritten.forEach((r, i) => {
    if (r.van !== oudeVan[volgorde[i]]) { r.handmatig = false; r._voor = null; }
  });
  save(); tekenDag(ds); tekenStats();
  await berekenDag(ui.ym, ds);
}
$('#dayList').addEventListener('pointerup', sleepAfronden);
$('#dayList').addEventListener('pointercancel', sleepAfronden);
/* Voorkomt dat de standaard HTML5-sleepactie het pointer-slepen in de weg zit */
$('#dayList').addEventListener('dragstart', ev => { if (versleep.el) ev.preventDefault(); });

$('#dayList').addEventListener('input', ev => {
  const el = ev.target.closest('[data-act="remark"]');
  if (!el) return;
  const ds = dagVan(el);
  const dag = getDag(ui.ym, ds, true);
  dag.opmerking = el.value;
  save();
  const chips = $$('.chip', el.closest('.day-body'));
  chips.forEach(c => c.classList.toggle('on', c.dataset.val === el.value));
});

/* ============================================================
   Maandnavigatie en snelle acties
   ============================================================ */
$('#prevMonth').onclick = () => { ui.ym = shiftYm(ui.ym, -1); ui.open.clear(); tekenMaand(); tekenOverzicht(); };
$('#nextMonth').onclick = () => { ui.ym = shiftYm(ui.ym, 1); ui.open.clear(); tekenMaand(); tekenOverzicht(); };
$('#btnToday').onclick = () => { ui.ym = nowYm(); ui.open.clear(); tekenMaand(); tekenOverzicht(); };

$('#hideWeekend').onchange = e => { D.settings.hideWeekend = e.target.checked; save(); tekenMaand(); };

/* Vergoeding per km voor de getoonde maand. Wordt per maand vastgelegd; een
   wijziging hier corrigeert bewust alleen deze maand (terugwerkende correctie
   bij een gewijzigd tarief). De standaard voor nieuwe maanden staat bij
   Instellingen. */
$('#stRate').oninput = e => {
  const v = parseFloat(String(e.target.value).replace(',', '.'));
  const rate = (isFinite(v) && v >= 0) ? v : 0;
  getMaand(ui.ym).vergoeding = rate;
  save();
  $('#stTotal').textContent = eur(maandKm(ui.ym) * rate);   // bedrag live bijwerken, input niet herrenderen (geen cursorsprong)
  tekenOverzicht();
};
$('#stRate').onblur = e => {   // na het typen netjes terug naar 0,00-notatie met komma
  const v = parseFloat(String(e.target.value).replace(',', '.'));
  const rate = (isFinite(v) && v >= 0) ? v : 0;
  e.target.value = rate.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

$('#btnFillWeek').onclick = async () => {
  const s = D.settings;
  if (!s.stdVan || !s.stdNaar) { toast('Stel eerst een standaardrit in bij Instellingen', true); return; }
  const ok = await bevestig('Werkdagen vullen',
    'Alle werkdagen (ma–vr) in ' + ymLabel(ui.ym) + ' zonder ritten en zonder opmerking krijgen de standaardrit ' +
    locNaam(locById(s.stdVan)) + ' → ' + locNaam(locById(s.stdNaar)) + (s.stdRetour ? ' en retour' : '') + '. Doorgaan?');
  if (!ok) return;
  const doelen = [];
  for (const d of maandDagen(ui.ym)) {
    if (d.weekend) continue;
    if (d.data && (d.data.ritten.length || d.data.opmerking)) continue;
    const dag = getDag(ui.ym, d.ds, true);
    dag.ritten.push({ id: uid(), van: s.stdVan, naar: s.stdNaar, km: null, kmA: null });
    if (s.stdRetour) dag.ritten.push({ id: uid(), van: s.stdNaar, naar: s.stdVan, km: null, kmA: null });
    doelen.push(d.ds);
  }
  save(); tekenMaand();
  for (const ds of doelen) await berekenDag(ui.ym, ds);
  tekenMaand();
  toast(doelen.length + ' dagen gevuld');
};

