/* ============================================================
   Overzicht
   ============================================================ */
function maxRitten(ym) {
  return Math.max(1, ...maandDagen(ym).map(d => (d.data ? d.data.ritten.length : 0)));
}
function overzichtMatrix(ym) {
  const n = maxRitten(ym);
  const kop = ['Datum', 'Dag', 'Opmerkingen', 'Dag km', 'Van'];
  for (let i = 1; i <= n; i++) kop.push('Naar ' + i, 'Km ' + i);
  const rijen = maandDagen(ym).map(d => {
    const dag = d.data;
    const ritten = dag ? dag.ritten : [];
    const rij = [pad(d.dag) + '/' + ym.split('-')[1], WEEKDAGEN[d.dow], dag ? (dag.opmerking || '') : '', dagKm(dag) || 0];
    rij.push(ritten.length ? locKort(locById(ritten[0].van)) : '');
    for (let i = 0; i < n; i++) {
      const r = ritten[i];
      rij.push(r ? locKort(locById(r.naar)) : '');
      rij.push(r ? (r.kmA == null ? 0 : r.kmA) : 0);
    }
    return { rij, weekend: d.weekend };
  });
  return { kop, rijen, n };
}

function tekenOverzicht() {
  const ym = ui.ym;
  const km = maandKm(ym);
  const s = maandInstellingen(ym);           // vergoeding en persoonsgegevens zoals vastgelegd in deze maand
  const rate = Number(s.vergoeding) || 0;
  $('#ovTitle').textContent = 'Maandoverzicht ' + ymLabel(ym);
  $('#ovHeader').innerHTML =
    '<div class="card" style="padding:14px 16px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">' +
    kv('Naam', esc(s.naam || '—')) +
    kv('Motor / auto', esc(s.voertuig === 'motor' ? 'Motor' : 'Auto')) +
    kv('Kenteken', esc(s.kenteken || '—')) +
    kv('Maand', esc(ymLabel(ym))) +
    kv('Totaal km', km.toLocaleString('nl-NL')) +
    kv('Vergoeding/km', eur(rate)) +
    kv('Totaal in euro', '<strong style="color:var(--primary-dark)">' + eur(km * rate) + '</strong>') +
    '</div>';

  const { kop, rijen } = overzichtMatrix(ym);
  const numCols = new Set();
  kop.forEach((k, i) => { if (k === 'Dag km' || /^Km /.test(k)) numCols.add(i); });
  let h = '<thead><tr>' + kop.map((k, i) => '<th class="' + (numCols.has(i) ? 'num' : '') + '">' + esc(k) + '</th>').join('') + '</tr></thead><tbody>';
  for (const r of rijen) {
    h += '<tr class="' + (r.weekend ? 'wknd' : '') + '">' +
      r.rij.map((c, i) => '<td class="' + (numCols.has(i) ? 'num' : '') + '">' +
        (numCols.has(i) ? (c ? c : '') : esc(c)) + '</td>').join('') + '</tr>';
  }
  h += '</tbody><tfoot><tr><td colspan="3">Totaal ' + esc(ymLabel(ym)) + '</td><td class="num">' + km + '</td>' +
    '<td colspan="' + (kop.length - 4) + '">' + km + ' km × ' + eur(rate) + ' = <strong>' + eur(km * rate) + '</strong></td></tr></tfoot>';
  $('#ovTable').innerHTML = h;
}
function kv(k, v) {
  return '<div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted-2);font-weight:700">' +
    k + '</div><div style="font-weight:600;margin-top:2px">' + v + '</div></div>';
}

