/* ============================================================
   Zoekende keuzelijst voor locaties
   Typen filtert op elk deel van de naam, het adres of een alias.
   ============================================================ */
function normaliseer(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function woordStart(tekst, term) {
  let i = tekst.indexOf(term);
  while (i >= 0) {
    if (i === 0 || !/[a-z0-9]/.test(tekst[i - 1])) return true;
    i = tekst.indexOf(term, i + 1);
  }
  return false;
}
/* Losse letters in volgorde, zodat "hkaf" ook "Hoofdkantoor Amersfoort" vindt. */
function isSubreeks(tekst, term) {
  let i = 0;
  for (let k = 0; k < tekst.length && i < term.length; k++) if (tekst[k] === term[i]) i++;
  return i === term.length;
}

function comboScore(l, termen) {
  const naam = normaliseer(l.naam || locKort(l));
  const extra = normaliseer(locAdres(l) + ' ' + (l.aliassen || []).join(' ') + ' ' + (l.plaats || ''));
  let score = 0;
  for (const t of termen) {
    if (naam.startsWith(t)) score += 140;
    else if (woordStart(naam, t)) score += 100;
    else if (naam.indexOf(t) >= 0) score += 70;          // midden in de naam
    else if (woordStart(extra, t)) score += 45;
    else if (extra.indexOf(t) >= 0) score += 30;
    else if (isSubreeks(naam, t)) score += 12;
    else return -1;                                       // deze term komt nergens voor
  }
  if (isFavoriet(l.id)) score += 25;
  score += Math.min(20, favTelling(l.id));
  score -= Math.min(6, naam.length / 14);
  return score;
}

function comboZoek(q) {
  const termen = normaliseer(q).split(/\s+/).filter(Boolean);
  const bron = D.locaties.filter(l => !l.gearchiveerd);   // gearchiveerde locaties niet aanbieden
  if (!termen.length) {
    const byNaam = (a, b) => locNaam(a).localeCompare(locNaam(b), 'nl');
    const fav = bron.filter(l => isFavoriet(l.id)).sort((a, b) => favTelling(b.id) - favTelling(a.id) || byNaam(a, b));
    const rest = bron.filter(l => !isFavoriet(l.id)).sort(byNaam);
    return { fav, rest, termen };
  }
  const gescoord = [];
  for (const l of bron) {
    const s = comboScore(l, termen);
    if (s >= 0) gescoord.push({ l, s });
  }
  gescoord.sort((a, b) => b.s - a.s || locNaam(a.l).localeCompare(locNaam(b.l), 'nl'));
  return { fav: [], rest: gescoord.map(x => x.l), termen };
}

function markeer(tekst, termen) {
  if (!termen.length) return esc(tekst);
  const genorm = normaliseer(tekst);
  const vlaggen = new Array(tekst.length).fill(false);
  for (const t of termen) {
    let i = genorm.indexOf(t);
    while (i >= 0) {
      for (let k = i; k < i + t.length && k < vlaggen.length; k++) vlaggen[k] = true;
      i = genorm.indexOf(t, i + 1);
    }
  }
  let uit = '', aan = false;
  for (let i = 0; i < tekst.length; i++) {
    if (vlaggen[i] && !aan) { uit += '<mark>'; aan = true; }
    if (!vlaggen[i] && aan) { uit += '</mark>'; aan = false; }
    uit += esc(tekst[i]);
  }
  return uit + (aan ? '</mark>' : '');
}

const combo = { input: null, items: [], index: 0, vorigeId: '', bezig: false };
const COMBO_MAX = 60;

function comboItemHtml(l, termen, actief) {
  const ster = isFavoriet(l.id) ? '<span class="ster">★</span>' : '';
  return '<div class="combo-item' + (actief ? ' actief' : '') + '" data-id="' + esc(l.id) + '">' +
    ster + '<span class="nm">' + markeer(locNaam(l) || locKort(l), termen) + '</span>' +
    '<span class="ad">' + markeer(locKort(l), termen) + '</span></div>';
}

function comboTeken(q) {
  const paneel = $('#comboPaneel');
  const { fav, rest, termen } = comboZoek(q);
  combo.items = fav.concat(rest).slice(0, COMBO_MAX);
  if (combo.index >= combo.items.length) combo.index = 0;

  let h = '<div class="combo-item huidige" data-id="' + HUIDIGE_LOC + '">📍 Huidige locatie</div>';
  if (!combo.items.length) {
    h += '<div class="combo-leeg">Geen locatie gevonden. Je kunt hem hieronder toevoegen.</div>';
  } else if (fav.length && !termen.length) {
    h += '<div class="combo-kop">Meest gebruikt</div>';
    h += fav.map((l, i) => comboItemHtml(l, termen, i === combo.index)).join('');
    h += '<div class="combo-kop">Alle locaties</div>';
    h += rest.slice(0, COMBO_MAX - fav.length).map((l, i) => comboItemHtml(l, termen, fav.length + i === combo.index)).join('');
  } else {
    h += combo.items.map((l, i) => comboItemHtml(l, termen, i === combo.index)).join('');
  }
  if (D.locaties.length > combo.items.length && termen.length === 0) {
    h += '<div class="combo-kop">' + (D.locaties.length - combo.items.length) + ' meer — typ om te zoeken</div>';
  }
  h += '<div class="combo-item nieuw" data-id="' + NEW_LOC + '">➕ Nieuwe locatie toevoegen…</div>';
  paneel.innerHTML = h;
  paneel.classList.remove('hidden');
  comboPositie();
  const actief = paneel.querySelector('.combo-item.actief');
  if (actief) actief.scrollIntoView({ block: 'nearest' });
}

function comboPositie() {
  const paneel = $('#comboPaneel'), inp = combo.input;
  if (!inp) return;
  const r = inp.getBoundingClientRect();
  const breedte = Math.max(r.width, 260);
  const ruimteOnder = window.innerHeight - r.bottom;
  const hoogte = Math.min(290, paneel.scrollHeight + 8);
  paneel.style.width = Math.min(breedte, window.innerWidth - 16) + 'px';
  paneel.style.left = Math.max(8, Math.min(r.left, window.innerWidth - breedte - 8)) + 'px';
  if (ruimteOnder < hoogte + 12 && r.top > ruimteOnder) {
    paneel.style.top = Math.max(8, r.top - hoogte - 4) + 'px';
  } else {
    paneel.style.top = (r.bottom + 4) + 'px';
  }
}

function comboOpen(input, selecteerTekst) {
  combo.input = input;
  combo.vorigeId = input.dataset.id || '';
  combo.index = 0;
  comboTeken(selecteerTekst ? '' : input.value);
  if (selecteerTekst) setTimeout(() => { try { input.select(); } catch (e) { /* niet kritisch */ } }, 0);
}

function comboSluit(herstel) {
  const inp = combo.input;
  $('#comboPaneel').classList.add('hidden');
  if (inp && herstel) {
    inp.dataset.id = combo.vorigeId;
    inp.value = combo.vorigeId ? locLabel(locById(combo.vorigeId)) : '';
  }
  combo.input = null; combo.items = []; combo.index = 0;
}

async function comboKies(id) {
  const inp = combo.input;
  if (!inp) return;
  const doel = { combo: inp.dataset.combo, ds: inp.dataset.ds, i: inp.dataset.i, veld: inp.dataset.veld, sleutel: inp.dataset.sleutel };
  comboSluit(false);
  if (id === HUIDIGE_LOC) {
    id = await comboHuidigeLocatie();
    if (!id) { if (doel.combo === 'rit') tekenDag(doel.ds); else vulSelects(); return; }
  } else if (id === NEW_LOC) {
    const nieuw = await locatieModal(null);
    if (!nieuw) { if (doel.combo === 'rit') tekenDag(doel.ds); else vulSelects(); return; }
    id = nieuw.id;
  }
  if (doel.combo === 'rit') await zetRitLocatie(doel.ds, +doel.i, doel.veld, id);
  else if (doel.combo === 'instelling') { D.settings[doel.sleutel] = id; save(); vulSelects(); }
}

document.addEventListener('focusin', e => {
  const inp = e.target.closest('input.combo-input');
  if (!inp || inp.disabled) { if (combo.input && !e.target.closest('#comboPaneel')) comboSluit(true); return; }
  if (inp !== combo.input) comboOpen(inp, true);
});
/* Na een keuze blijft het veld gefocust; opnieuw klikken of typen moet de lijst weer openen. */
document.addEventListener('click', e => {
  const inp = e.target.closest('input.combo-input');
  if (inp && !inp.disabled && inp !== combo.input) comboOpen(inp, true);
});
document.addEventListener('input', e => {
  const inp = e.target.closest('input.combo-input');
  if (!inp || inp.disabled) return;
  if (inp !== combo.input) comboOpen(inp, false);
  combo.index = 0;
  comboTeken(inp.value);
});
document.addEventListener('keydown', e => {
  if (!combo.input || e.target !== combo.input) return;
  const n = combo.items.length + 1;   // inclusief "nieuwe locatie"
  if (e.key === 'ArrowDown') { combo.index = (combo.index + 1) % n; comboTeken(combo.input.value); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { combo.index = (combo.index - 1 + n) % n; comboTeken(combo.input.value); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === 'Tab') {
    const gekozen = combo.index < combo.items.length ? combo.items[combo.index].id : NEW_LOC;
    if (e.key === 'Enter') e.preventDefault();
    comboKies(gekozen);
  } else if (e.key === 'Escape') { comboSluit(true); combo.input && combo.input.blur(); e.preventDefault(); }
});
$('#comboPaneel').addEventListener('pointerdown', e => e.preventDefault());  // houd de focus in het invoerveld
$('#comboPaneel').addEventListener('click', e => {
  const it = e.target.closest('.combo-item');
  if (it) comboKies(it.dataset.id);
});
document.addEventListener('pointerdown', e => {
  if (combo.input && !e.target.closest('#comboPaneel') && !e.target.closest('input.combo-input')) comboSluit(true);
});
window.addEventListener('resize', () => { if (combo.input) comboPositie(); });
window.addEventListener('scroll', () => { if (combo.input) comboPositie(); }, true);

/* Bouwt een keuzeveld; attrs worden als data-attributen meegegeven. */
function comboVeld(attrs, id, placeholder) {
  const a = Object.keys(attrs).map(k => 'data-' + k + '="' + esc(attrs[k]) + '"').join(' ');
  const label = id ? locLabel(locById(id)) : '';
  return '<input type="text" class="combo-input' + (label ? '' : ' leeg') + '" autocomplete="off" spellcheck="false" ' +
    a + ' data-id="' + esc(id || '') + '" value="' + esc(label) + '" placeholder="' + esc(placeholder || 'Zoek locatie…') + '">';
}

