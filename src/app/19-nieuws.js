/* ============================================================
   Nieuwsberichten: nieuwe functionaliteit onder de aandacht brengen
   Elk bericht heeft een vaste id. Zodra de gebruiker het als gelezen
   markeert, wordt die id bewaard in D.gelezenBerichten en verschijnt
   het bericht niet meer. “Later” sluit het alleen voor nu.
   ============================================================ */
const BERICHTEN = [
  {
    id: 'huidige-locatie',
    titel: 'Nieuw: 📍 Huidige locatie',
    html:
      '<p style="margin:0 0 10px">Bij het kiezen van een vertrek- of bestemmingslocatie staat nu bovenaan de optie ' +
      '<strong>📍 Huidige locatie</strong>.</p>' +
      '<p style="margin:0 0 10px">De app bepaalt via GPS waar je bent, hergebruikt een bekende locatie in de buurt, of ' +
      'stelt een nieuwe voor — inclusief adres en een naamvoorstel op basis van wat er op die plek zit ' +
      '(bijvoorbeeld een restaurant of bedrijf).</p>' +
      '<p class="muted" style="margin:0;font-size:13px">Je hoeft alleen eenmalig toestemming voor je locatie te geven.</p>'
  },
  {
    id: 'onedrive-multidevice',
    titel: 'Nieuw: ☁️ je administratie op meerdere apparaten',
    html:
      '<p style="margin:0 0 10px">Je kunt je kilometeradministratie nu op meerdere apparaten bijhouden — bijvoorbeeld op je ' +
      '<strong>laptop én je telefoon</strong> — via <strong>OneDrive</strong>.</p>' +
      '<p style="margin:0 0 10px">Bij <strong>Instellingen → Meerdere apparaten · OneDrive</strong> kies je voor OneDrive-opslag en log je in met je ' +
      'Microsoft-account. Je administratie staat dan in een eigen map in jouw OneDrive en synchroniseert automatisch tussen je apparaten. ' +
      'Wijzig je iets op een ander apparaat, dan merkt de app dat en vraagt welke versie voorgaat.</p>' +
      '<p class="muted" style="margin:0;font-size:13px">Blijf je liever op één apparaat werken? Dan verandert er niets: “dit apparaat” blijft de standaard.</p>'
  }
];

function berichtGelezen(id) { return (D.gelezenBerichten || []).includes(id); }
function markeerBerichtGelezen(id) {
  D.gelezenBerichten = D.gelezenBerichten || [];
  if (!D.gelezenBerichten.includes(id)) { D.gelezenBerichten.push(id); save(); }
  tekenNieuwsBadge();
}
/* Aantal ongelezen berichten als badge op het menu-item "Nieuws". */
function tekenNieuwsBadge() {
  const el = $('#nieuwsBadge');
  if (!el) return;
  const n = BERICHTEN.filter(b => !berichtGelezen(b.id)).length;
  el.textContent = n ? String(n) : '';
  el.classList.toggle('on', n > 0);
}
function volgendeOngelezenBericht() { return BERICHTEN.find(b => !berichtGelezen(b.id)) || null; }

/* Toont één bericht in een pop-up.
   cyclus=true: opstart-modus — “Later” sluit, “Als gelezen markeren” toont meteen het volgende ongelezen bericht.
   cyclus=false: opnieuw lezen vanuit Hulp — alleen sluiten (en markeren als het nog ongelezen is). */
function toonBerichtModal(b, cyclus) {
  const ongelezen = !berichtGelezen(b.id);
  const knoppen = cyclus
    ? '<button class="btn" data-x="later">Later</button><button class="btn primary" data-x="gelezen">Als gelezen markeren</button>'
    : (ongelezen
        ? '<button class="btn" data-x="later">Sluiten</button><button class="btn primary" data-x="gelezen">Als gelezen markeren</button>'
        : '<button class="btn primary" data-x="later">Sluiten</button>');
  const m = openModal(
    '<header><h3>' + esc(b.titel) + '</h3></header>' +
    '<div class="body">' + b.html + '</div>' +
    '<footer>' + knoppen + '</footer>');
  m.host.addEventListener('click', e => {
    const btn = e.target.closest('[data-x]');
    if (!btn) return;
    m.close();
    if (btn.dataset.x === 'gelezen') { markeerBerichtGelezen(b.id); if (cyclus) toonBerichten(); }
    tekenBerichtenLijst();
  });
}

/* Opstart: toon het eerste ongelezen bericht (en daarna eventueel de volgende). */
function toonBerichten() {
  const b = volgendeOngelezenBericht();
  if (b) toonBerichtModal(b, true);
}

/* Overzicht bij Hulp: alle berichten, opnieuw te lezen. */
function tekenBerichtenLijst() {
  const host = $('#berichtenLijst');
  if (!host) return;
  if (!BERICHTEN.length) { host.innerHTML = '<p class="muted" style="margin:0;font-size:13.5px">Er zijn nog geen berichten.</p>'; return; }
  host.innerHTML = BERICHTEN.map(b =>
    '<div class="row" style="justify-content:space-between;gap:12px;align-items:center;padding:9px 0;border-top:1px solid var(--border)">' +
    '<div style="min-width:0"><div style="font-weight:600">' + esc(b.titel) + '</div>' +
    '<div class="muted" style="font-size:12px">' + (berichtGelezen(b.id) ? 'gelezen' : 'nieuw') + '</div></div>' +
    '<button class="btn sm" data-bericht="' + esc(b.id) + '">Lezen</button></div>').join('');
}
$('#berichtenLijst').addEventListener('click', e => {
  const btn = e.target.closest('[data-bericht]');
  if (!btn) return;
  const b = BERICHTEN.find(x => x.id === btn.dataset.bericht);
  if (b) toonBerichtModal(b, false);
});

