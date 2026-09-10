/* ============================================================
   Automatische favorieten: meest gebruikt in de afgelopen maanden
   ============================================================ */
const FAV_MAANDEN = 6;
let favCache = null;
function vergeetFavorieten() { favCache = null; }

/* Telt hoe vaak elke locatie voorkomt in ritten van de laatste N maanden. */
function gebruikInPeriode(maanden) {
  const nu = new Date();
  const grens = new Date(nu.getFullYear(), nu.getMonth() - (maanden - 1), 1);
  const telling = {};
  for (const ym of Object.keys(D.maanden)) {
    const p = ym.split('-').map(Number);
    if (new Date(p[0], p[1] - 1, 1) < grens) continue;
    const dagen = D.maanden[ym].dagen || {};
    for (const ds of Object.keys(dagen)) {
      for (const r of dagen[ds].ritten) {
        if (r.van) telling[r.van] = (telling[r.van] || 0) + 1;
        if (r.naar) telling[r.naar] = (telling[r.naar] || 0) + 1;
      }
    }
  }
  return telling;
}

function favorieten() {
  if (favCache) return favCache;
  const aantal = Math.max(1, Math.min(30, Number(D.settings.aantalFavorieten) || 8));
  const telling = gebruikInPeriode(FAV_MAANDEN);
  const gebruikt = Object.keys(telling).filter(id => telling[id] > 0 && locById(id));
  gebruikt.sort((a, b) => telling[b] - telling[a] ||
    locNaam(locById(a)).localeCompare(locNaam(locById(b)), 'nl'));
  const set = new Set(gebruikt.slice(0, aantal));
  // Handmatig vastgezette locaties staan er altijd bij
  D.locaties.forEach(l => { if (l.vast) set.add(l.id); });
  favCache = { set, telling, automatisch: gebruikt.length > 0 };
  return favCache;
}
function isFavoriet(id) { return favorieten().set.has(id); }
function favTelling(id) { return favorieten().telling[id] || 0; }

