/* ============================================================
   Netwerk: geocoding (Nominatim) + routeafstand (OSRM)
   ============================================================ */
function createQueue(gap) {
  let tail = Promise.resolve(); let last = 0;
  return function (fn) {
    const run = tail.then(async () => {
      const wait = gap - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      last = Date.now();
      return fn();
    });
    tail = run.catch(() => {});
    return run;
  };
}
const NOMQ = createQueue(1150);
const OSRMQ = createQueue(300);

function nominatimQuery(loc) {
  if (loc.straat && loc.huisnummer) {
    return [loc.straat + ' ' + loc.huisnummer, [loc.postcode, loc.plaats].filter(Boolean).join(' '), 'Nederland']
      .filter(s => s && s.trim()).join(', ');
  }
  return [[loc.postcode, loc.huisnummer].filter(Boolean).join(' '), loc.plaats, 'Nederland']
    .filter(s => s && String(s).trim()).join(', ');
}

async function zoekAdres(tekst) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=nl&q=' +
    encodeURIComponent(tekst);
  const res = await NOMQ(() => fetch(url, { headers: { 'Accept': 'application/json' } }).then(r => r.json()));
  return Array.isArray(res) ? res : [];
}

async function ensureCoords(loc) {
  if (loc.lat != null && loc.lon != null) return loc;
  const res = await zoekAdres(nominatimQuery(loc));
  if (!res.length) throw new Error('adres niet gevonden');
  loc.lat = parseFloat(res[0].lat);
  loc.lon = parseFloat(res[0].lon);
  if (!loc.straat && res[0].address && res[0].address.road) loc.straat = res[0].address.road;
  if (!loc.plaats && res[0].address) loc.plaats = res[0].address.city || res[0].address.town || res[0].address.village || '';
  save();
  return loc;
}

/* ============================================================
   Huidige locatie via GPS + reverse-geocoding (naamvoorstel)
   ============================================================ */
function huidigePositie() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('deze browser heeft geen locatievoorziening')); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      e => reject(new Error(e && e.code === 1 ? 'je hebt geen toestemming voor je locatie gegeven' : 'je locatie kon niet worden bepaald')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

/* Bestaande locatie binnen maxMeter van dit punt (voorkomt dubbele locaties). */
function dichtstbijLocatie(lat, lon, maxMeter) {
  let best = null, bestKm = Infinity;
  for (const l of D.locaties) {
    if (l.lat == null || l.lon == null) continue;
    const d = haversine({ lat, lon }, { lat: l.lat, lon: l.lon });
    if (d < bestKm) { bestKm = d; best = l; }
  }
  return (best && bestKm * 1000 <= maxMeter) ? best : null;
}

/* Reverse-geocoding: adresgegevens (en eventueel een naam) op deze coördinaten. */
async function reverseAdres(lat, lon) {
  const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&namedetails=1&zoom=18&lat=' + lat + '&lon=' + lon;
  const r = await NOMQ(() => fetch(url, { headers: { 'Accept': 'application/json' } }).then(x => x.json()));
  const a = (r && r.address) || {};
  return {
    straat: a.road || '',
    huisnummer: a.house_number || '',
    postcode: a.postcode || '',
    plaats: a.city || a.town || a.village || a.municipality || a.suburb || '',
    naam: (r && r.namedetails && r.namedetails.name) || (r && r.name) || ''
  };
}

/* Dichtstbijzijnde genoemde plek (restaurant, winkel, bedrijf…) via Overpass — naamvoorstel. */
const OVERPASSQ = createQueue(1100);
async function poiNaamDichtbij(lat, lon, straal) {
  const soorten = ['amenity', 'shop', 'office', 'tourism', 'leisure', 'craft'];
  const q = '[out:json][timeout:12];(' +
    soorten.map(s => 'node(around:' + straal + ',' + lat + ',' + lon + ')[name][' + s + '];').join('') +
    soorten.map(s => 'way(around:' + straal + ',' + lat + ',' + lon + ')[name][' + s + '];').join('') +
    ');out center tags 30;';
  try {
    const r = await OVERPASSQ(() => fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q)
    }).then(x => x.json()));
    let best = null, bestKm = Infinity;
    for (const e of ((r && r.elements) || [])) {
      const elat = e.lat != null ? e.lat : (e.center && e.center.lat);
      const elon = e.lon != null ? e.lon : (e.center && e.center.lon);
      if (elat == null || elon == null || !e.tags || !e.tags.name) continue;
      const d = haversine({ lat, lon }, { lat: elat, lon: elon });
      if (d < bestKm) { bestKm = d; best = e.tags.name; }
    }
    return best;
  } catch (e) { return null; }
}

/* "Huidige locatie": GPS → bestaande locatie hergebruiken, of een nieuwe met naamvoorstel. */
async function comboHuidigeLocatie() {
  let pos;
  toast('Je locatie bepalen…');
  try { pos = await huidigePositie(); }
  catch (e) { toast(e.message || 'locatie bepalen mislukt', true); return null; }

  const bestaand = dichtstbijLocatie(pos.lat, pos.lon, 60);
  if (bestaand) { toast('Je staat bij een bekende locatie: ' + locNaam(bestaand)); return bestaand.id; }

  toast('Opzoeken wat hier is…');
  let adres = { straat: '', huisnummer: '', postcode: '', plaats: '', naam: '' };
  try { adres = await reverseAdres(pos.lat, pos.lon); } catch (e) { /* adres blijft leeg */ }
  let naam = adres.naam;
  try { const poi = await poiNaamDichtbij(pos.lat, pos.lon, 70); if (poi) naam = poi; } catch (e) { /* geen POI gevonden */ }

  const voorinvul = {
    id: null, naam: naam || '', straat: adres.straat, huisnummer: adres.huisnummer,
    postcode: adres.postcode, plaats: adres.plaats, lat: pos.lat, lon: pos.lon, vast: false, aliassen: []
  };
  const nieuw = await locatieModal(null, voorinvul);
  return nieuw ? nieuw.id : null;
}

function haversine(a, b) {
  const R = 6371, rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* Zoekt een bekende afstand op. Staat "heen- en terugreis gelijk houden" aan, dan telt ook de
   omgekeerde richting mee; de meest betrouwbare bron wint (eigen tabel boven berekende route). */
const BRON_RANG = { opgegeven: 3, route: 2, schatting: 1 };
function paarAfstand(vanId, naarId) {
  const heen = D.afstanden[vanId + '|' + naarId] || null;
  if (!D.settings.spiegelAfstand) return heen;
  const terug = D.afstanden[naarId + '|' + vanId] || null;
  if (!terug) return heen;
  if (!heen) return { km: terug.km, bron: 'retour' };
  return (BRON_RANG[terug.bron] || 0) > (BRON_RANG[heen.bron] || 0) ? { km: terug.km, bron: 'retour' } : heen;
}

async function routeAfstand(vanId, naarId) {
  if (vanId === naarId) return { km: 0, bron: 'gelijk' };
  const key = vanId + '|' + naarId;
  const bekend = paarAfstand(vanId, naarId);
  if (bekend) return bekend;
  const a = locById(vanId), b = locById(naarId);
  if (!a || !b) {
    const fout = new Error('een van de locaties bestaat niet meer');
    fout.locaties = [!a ? vanId : naarId];
    throw fout;
  }
  // Beide adressen apart opzoeken, zodat we kunnen benoemen wélke locatie het probleem is
  const mislukt = [];
  for (const l of [a, b]) {
    try { await ensureCoords(l); } catch (e) { mislukt.push({ l: l, reden: e.message }); }
  }
  if (mislukt.length) {
    const namen = mislukt.map(x => '“' + locNaam(x.l) + '” (' + (locKort(x.l) || 'geen adres') + ')');
    const fout = new Error('het adres van ' + namen.join(' en ') + ' kon niet worden opgezocht');
    fout.locaties = mislukt.map(x => x.l.id);
    throw fout;
  }
  let out;
  try {
    const url = 'https://router.project-osrm.org/route/v1/driving/' +
      a.lon + ',' + a.lat + ';' + b.lon + ',' + b.lat + '?overview=false&alternatives=false&steps=false';
    const j = await OSRMQ(() => fetch(url).then(r => r.json()));
    if (j && j.routes && j.routes[0]) out = { km: j.routes[0].distance / 1000, bron: 'route' };
    else throw new Error('geen route');
  } catch (e) {
    // Geen schattingen meer: een onbetrouwbare afstand mag niet in de declaratie belanden.
    // De afstand blijft onbepaald; de gebruiker vult die zelf in (die krijgt het label 'handmatig').
    const fout = new Error('de route tussen “' + locNaam(a) + '” en “' + locNaam(b) +
      '” kon niet worden opgehaald; vul de afstand handmatig in');
    fout.locaties = [];
    throw fout;
  }
  D.afstanden[key] = out;
  save();
  return out;
}

function afrond(km) {
  if (km == null) return null;
  const mode = D.settings.afronding || 'ceil';
  if (mode === 'ceil') return Math.ceil(km - 1e-9);
  if (mode === 'round') return Math.round(km);
  return Math.round(km * 10) / 10;
}

