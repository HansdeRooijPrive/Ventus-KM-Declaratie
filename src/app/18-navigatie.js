/* ============================================================
   Navigatie
   ============================================================ */
function gaNaar(view) {
  meldOnthoudView(view);        // scherm van herkomst vastleggen vóór de wissel (gaat mee in een melding)
  ui.view = view;
  $$('#tabs button').forEach(x => x.classList.toggle('active', x.dataset.view === view));
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + view));
  if (view === 'overzicht') tekenOverzicht();
  if (view === 'locaties') tekenLocaties();
  if (view === 'instellingen') vulInstellingen();
  if (view === 'handleiding') bouwHandleiding();
  if (view === 'nieuws') tekenBerichtenLijst();
  if (view === 'wijziging') tekenMeldForm('wijziging');
  if (view === 'bug') tekenMeldForm('bug');
  if (view === 'over') tekenVersie();
  if (view === 'welkom') tekenWelkom();
}
$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-view]');
  if (b) gaNaar(b.dataset.view);
});

