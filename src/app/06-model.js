/* ============================================================
   Maand- en dagmodel
   ============================================================ */
function getMaand(ym) {
  if (!D.maanden[ym]) D.maanden[ym] = { dagen: {} };
  if (!D.maanden[ym].dagen) D.maanden[ym].dagen = {};
  return D.maanden[ym];
}
function getDag(ym, dateStr, maak) {
  const m = getMaand(ym);
  if (!m.dagen[dateStr] && maak) { m.dagen[dateStr] = { opmerking: '', ritten: [] }; borgMaandInstellingen(ym); }
  return m.dagen[dateStr] || null;
}
function ritKm(r) { return r.kmA == null ? 0 : r.kmA; }
function dagKm(dag) { return dag ? dag.ritten.reduce((s, r) => s + ritKm(r), 0) : 0; }
function maandDagen(ym) {
  const out = [];
  const n = daysInMonth(ym);
  const [y, m] = ym.split('-').map(Number);
  for (let i = 1; i <= n; i++) {
    const ds = ym + '-' + pad(i);
    const dt = new Date(y, m - 1, i);
    out.push({ ds, dag: i, dow: dt.getDay(), weekend: dt.getDay() === 0 || dt.getDay() === 6, data: getDag(ym, ds) });
  }
  return out;
}
function maandKm(ym) { return maandDagen(ym).reduce((s, d) => s + dagKm(d.data), 0); }

/* ============================================================
   Maandgebonden instellingen (vergoeding, naam, kenteken, voertuig)
   Een fiscale rittenadministratie moet reproduceerbaar zijn: het tarief
   en de persoonsgegevens die golden toen de maand werd opgesteld liggen
   daarom vast ín de maand. Wijzig je later het tarief bij Instellingen,
   dan blijven eerder ingediende maanden hun eigen tarief tonen.
   ============================================================ */
function maandInstellingen(ym) {
  const m = D.maanden[ym] || {};
  return {
    vergoeding: (typeof m.vergoeding === 'number') ? m.vergoeding : (Number(D.settings.vergoeding) || 0),
    naam:       (m.naam != null)     ? m.naam     : (D.settings.naam || ''),
    kenteken:   (m.kenteken != null) ? m.kenteken : (D.settings.kenteken || ''),
    voertuig:   (m.voertuig != null) ? m.voertuig : (D.settings.voertuig || 'auto')
  };
}
/* Legt de huidige instellingen vast in de maand zodra die echt in gebruik
   wordt genomen. Idempotent: een al vastgelegde maand wordt niet overschreven. */
function borgMaandInstellingen(ym) {
  const m = D.maanden[ym];
  if (!m) return;
  if (typeof m.vergoeding !== 'number') m.vergoeding = Number(D.settings.vergoeding) || 0;
  if (m.naam == null)     m.naam = D.settings.naam || '';
  if (m.kenteken == null) m.kenteken = D.settings.kenteken || '';
  if (m.voertuig == null) m.voertuig = D.settings.voertuig || 'auto';
}

/* Eenmalige migratie bij het laden:
   1. Bestaande maanden met gegevens krijgen het laatst bekende (huidige) tarief
      vastgelegd, zodat een latere tariefwijziging ze niet met terugwerkende
      kracht verandert.
   2. Schattingen verdwijnen volledig — ze mogen niet meer gebruikt of hergebruikt
      worden. Geschatte afstanden worden gewist; de betreffende ritten vragen om een
      route-herberekening of een handmatige invoer. */
function migreer() {
  let veranderd = false;
  if (!Array.isArray(D.gelezenBerichten)) D.gelezenBerichten = [];
  for (const ym of Object.keys(D.maanden)) {
    const m = D.maanden[ym];
    if (typeof m.vergoeding !== 'number') {
      const dagen = m.dagen || {};
      const heeftData = Object.keys(dagen).some(ds =>
        (dagen[ds].ritten && dagen[ds].ritten.length) || dagen[ds].opmerking);
      if (heeftData) {
        m.vergoeding = Number(D.settings.vergoeding) || 0;
        m.naam = D.settings.naam || '';
        m.kenteken = D.settings.kenteken || '';
        m.voertuig = D.settings.voertuig || 'auto';
        veranderd = true;
      }
    }
  }
  for (const k of Object.keys(D.afstanden)) {
    if (D.afstanden[k] && D.afstanden[k].bron === 'schatting') { delete D.afstanden[k]; veranderd = true; }
  }
  for (const ym of Object.keys(D.maanden)) {
    const dagen = (D.maanden[ym] && D.maanden[ym].dagen) || {};
    for (const ds of Object.keys(dagen)) {
      for (const r of (dagen[ds].ritten || [])) {
        if (r.bron === 'schatting') { r.km = null; r.kmA = null; r.bron = null; r._voor = null; veranderd = true; }
      }
    }
  }
  if (veranderd) save();
}

function normaliseerKeten(dag) {
  for (let i = 1; i < dag.ritten.length; i++) dag.ritten[i].van = dag.ritten[i - 1].naar || '';
}

async function zetRitLocatie(ds, i, veld, id) {
  const dag = getDag(ui.ym, ds, true);
  const rit = dag.ritten[i];
  if (!rit) return;
  rit[veld] = id;
  rit.handmatig = false;
  rit._voor = null;
  normaliseerKeten(dag);
  save(); tekenDag(ds);
  await berekenDag(ui.ym, ds);
}

/* ============================================================
   Berekenen van ritten
   ============================================================ */
async function berekenDag(ym, ds) {
  const dag = getDag(ym, ds);
  if (!dag) return;
  normaliseerKeten(dag);
  let veranderd = false;
  for (const r of dag.ritten) {
    if (r.handmatig) continue;
    if (!r.van || !r.naar) { if (r.kmA != null) { r.km = null; r.kmA = null; veranderd = true; } continue; }
    if (r.km != null && r._voor === r.van + '|' + r.naar) { const nw = afrond(r.km); if (nw !== r.kmA) { r.kmA = nw; veranderd = true; } continue; }
    r.bezig = true; tekenDag(ds);
    try {
      const res = await routeAfstand(r.van, r.naar);
      r.km = res.km; r.kmA = afrond(res.km); r.bron = res.bron; r._voor = r.van + '|' + r.naar;
    } catch (e) {
      r.km = null; r.kmA = null; r.bron = 'fout';
      r.fout = e.message || 'onbekende fout';
      r.foutLocaties = e.locaties || [];
      toast('Afstand niet te bepalen: ' + r.fout, true);
    }
    r.bezig = false; veranderd = true;
    tekenDag(ds); tekenStats();
  }
  if (veranderd) { save(); tekenDag(ds); tekenStats(); }
}

/* Loopt alle opgeslagen ritten na en past de bekende afstanden opnieuw toe.
   Gebruikt alleen wat al bekend is, dus er is geen internet voor nodig. */
function herbepaalAlleAfstanden() {
  let aangepast = 0;
  for (const ym of Object.keys(D.maanden)) {
    const dagen = D.maanden[ym].dagen || {};
    for (const ds of Object.keys(dagen)) {
      for (const r of dagen[ds].ritten) {
        if (r.handmatig || !r.van || !r.naar) continue;
        const bekend = r.van === r.naar ? { km: 0, bron: 'gelijk' } : paarAfstand(r.van, r.naar);
        if (!bekend) continue;
        const nieuw = afrond(bekend.km);
        if (nieuw !== r.kmA || r.bron !== bekend.bron) {
          r.km = bekend.km; r.kmA = nieuw; r.bron = bekend.bron; r._voor = r.van + '|' + r.naar;
          aangepast++;
        }
      }
    }
  }
  if (aangepast) save();
  tekenMaand(); tekenOverzicht();
  return aangepast;
}

function herberekenAfronding() {
  for (const ym of Object.keys(D.maanden)) {
    for (const ds of Object.keys(D.maanden[ym].dagen)) {
      for (const r of D.maanden[ym].dagen[ds].ritten) {
        if (!r.handmatig && r.km != null) r.kmA = afrond(r.km);
      }
    }
  }
  save(); tekenMaand();
}

