/* ============================================================
   Handleiding (staat als tekst in ditzelfde bestand)
   ============================================================ */
let docKlaar = false;

function bouwHandleiding() {
  if (docKlaar) return;
  docKlaar = true;
  const host = $('#docTekst');

  // Alles vanaf de eerste H2 in secties groeperen, zodat zoeken hele hoofdstukken kan tonen of verbergen
  const kinderen = Array.from(host.childNodes);
  const nieuw = document.createDocumentFragment();
  let sectie = null;
  for (const el of kinderen) {
    if (el.nodeType === 1 && el.tagName === 'H2') {
      sectie = document.createElement('section');
      sectie.className = 'doc-sectie';
      sectie.dataset.id = el.id;
      nieuw.appendChild(sectie);
    }
    (sectie || nieuw).appendChild(el);
  }
  host.appendChild(nieuw);
  $$('.doc-sectie', host).forEach(s => { s.dataset.origineel = s.innerHTML; });

  $('#docInhoud').innerHTML = $$('.doc-sectie', host)
    .map(s => '<a href="#' + s.dataset.id + '" data-doel="' + s.dataset.id + '">' +
      esc(s.querySelector('h2').textContent) + '</a>').join('');
  docTelling(0, 0);
}

function docTelling(treffers, hoofdstukken) {
  const el = $('#docTeller');
  if (!el) return;
  el.textContent = treffers
    ? treffers + ' ' + (treffers === 1 ? 'treffer' : 'treffers') + ' in ' + mv(hoofdstukken, 'hoofdstuk', 'hoofdstukken')
    : '';
}

/* Markeert alle voorkomens van een term in de tekstknopen van een element. */
function docMarkeer(el, term) {
  const loper = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const raak = [];
  let n;
  while ((n = loper.nextNode())) {
    if (n.nodeValue.toLowerCase().indexOf(term) >= 0) raak.push(n);
  }
  let aantal = 0;
  for (const knoop of raak) {
    const tekst = knoop.nodeValue, laag = tekst.toLowerCase();
    const stuk = document.createDocumentFragment();
    let pos = 0, i;
    while ((i = laag.indexOf(term, pos)) >= 0) {
      if (i > pos) stuk.appendChild(document.createTextNode(tekst.slice(pos, i)));
      const m = document.createElement('mark');
      m.className = 'treffer';
      m.textContent = tekst.slice(i, i + term.length);
      stuk.appendChild(m);
      pos = i + term.length;
      aantal++;
    }
    if (pos < tekst.length) stuk.appendChild(document.createTextNode(tekst.slice(pos)));
    knoop.parentNode.replaceChild(stuk, knoop);
  }
  return aantal;
}

function docFilter(q) {
  const term = q.trim().toLowerCase();
  let treffers = 0, hoofdstukken = 0;
  for (const sec of $$('.doc-sectie')) {
    sec.innerHTML = sec.dataset.origineel;
    const link = $('#docInhoud a[data-doel="' + sec.dataset.id + '"]');
    if (!term) { sec.classList.remove('geenTreffer'); if (link) link.classList.remove('geenTreffer'); continue; }
    const heeft = sec.textContent.toLowerCase().indexOf(term) >= 0;
    sec.classList.toggle('geenTreffer', !heeft);
    if (link) link.classList.toggle('geenTreffer', !heeft);
    if (heeft) { hoofdstukken++; treffers += docMarkeer(sec, term); }
  }
  docTelling(treffers, hoofdstukken);
}

$('#docZoek').oninput = e => docFilter(e.target.value);
$('#docInhoud').addEventListener('click', e => {
  const a = e.target.closest('a[data-doel]');
  if (!a) return;
  e.preventDefault();
  const doel = document.getElementById(a.dataset.doel);
  if (doel) doel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $$('#docInhoud a').forEach(x => x.classList.toggle('actief', x === a));
});
window.addEventListener('scroll', () => {
  if (ui.view !== 'handleiding') return;
  const koppen = $$('#docTekst .doc-sectie:not(.geenTreffer) h2');
  let actief = null;
  for (const h of koppen) if (h.getBoundingClientRect().top < 120) actief = h;
  $$('#docInhoud a').forEach(a => a.classList.toggle('actief', !!actief && a.dataset.doel === actief.id));
}, { passive: true });
$('#btnDocPrint').onclick = () => {
  $('#view-handleiding').classList.add('print-me');
  window.print();
  setTimeout(() => $('#view-handleiding').classList.remove('print-me'), 500);
};

