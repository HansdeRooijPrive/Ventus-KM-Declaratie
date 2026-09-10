/* ============================================================
   Hulpfuncties
   ============================================================ */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function pad(n) { return String(n).padStart(2, '0'); }
function eur(n) {
  return '€ ' + (Number(n) || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nowYm() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
function ymLabel(ym) { const [y, m] = ym.split('-'); return MAANDEN[+m - 1] + ' ' + y; }
function daysInMonth(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function shiftYm(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1);
}
function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; setTimeout(() => el.remove(), 320); }, err ? 4200 : 2400);
}

/* ============================================================
   Locaties
   ============================================================ */
function locById(id) { return D.locaties.find(l => l.id === id) || null; }
function locAdres(l) {
  if (!l) return '';
  if (!l.straat) return locKort(l);
  const straat = [l.straat, l.huisnummer].filter(Boolean).join(' ').trim();
  return [straat, [l.postcode, l.plaats].filter(Boolean).join(' ').trim()].filter(Boolean).join(', ');
}
/* Compacte notatie zoals in een rittenadministratie: "1234 AB 12, Utrecht" */
function locKort(l) {
  if (!l) return '';
  const pc = [l.postcode, l.huisnummer].filter(Boolean).join(' ').trim();
  return [pc || [l.straat, l.huisnummer].filter(Boolean).join(' '), l.plaats].filter(Boolean).join(', ');
}
function locNaam(l) { return l ? (l.naam || locKort(l)) : ''; }

function locLabel(l) {
  if (!l) return '';
  return locNaam(l) + (l.plaats && l.naam && !l.naam.toLowerCase().includes(l.plaats.toLowerCase()) ? ' · ' + l.plaats : '');
}

