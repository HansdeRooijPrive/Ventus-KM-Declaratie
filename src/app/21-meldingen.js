/* ============================================================
   Meldingen: wijzigingsverzoek (user story) of bug melden
   De app stelt een gestructureerde melding samen en zet die via de
   mailclient van de gebruiker in Jira (mailhandler op het project).
   Geen server en geen API-token in de pagina nodig: de afzender is al
   geauthenticeerd via zijn eigen mail.
   Er gaat NOOIT iets uit de administratie mee (geen ritten, locaties,
   adressen of bedragen) — alleen de technische context uit meldContext().
   ============================================================ */
/* Jira-mailhandlers, per issuetype één adres: één handler maakt één issuetype aan.
   Is er maar één adres ingevuld, dan gaat alles daarheen (het onderwerp begint met
   [BUG] of [STORY], zodat een automatiseringsregel in Jira kan bijsturen).
   Beide leeg = nog niet ingericht: de app biedt dan alleen "Kopieer melding". */
const MELD_MAIL_BUG = '{{JIRA_MAIL_BUG}}';
const MELD_MAIL_STORY = '{{JIRA_MAIL_STORY}}';
const MELD_OMGEVING = '{{OMG_NAAM}}';   /* Productie / Acceptatie / Test */
const MELD_MAILTO_MAX = 1900;           /* boven deze lengte weigeren mailclients de mailto-link */

function meldMail(soort) {
  const eigen = soort === 'bug' ? MELD_MAIL_BUG : MELD_MAIL_STORY;
  return eigen || MELD_MAIL_BUG || MELD_MAIL_STORY || '';
}

const MELDSOORTEN = {
  bug: {
    prefix: '[BUG]',
    jira: 'Bug',
    knop: 'Bug versturen',
    velden: [
      { k: 'samenvatting', label: 'Korte omschrijving', type: 'tekst', verplicht: true,
        hint: 'Eén regel die de fout samenvat; dit wordt de titel in Jira.' },
      { k: 'stappen', label: 'Wat deed je?', type: 'lang', regels: 4, verplicht: true,
        kop: 'Stappen om te reproduceren', hint: 'De stappen om het na te doen, het liefst genummerd.' },
      { k: 'verwacht', label: 'Wat verwachtte je?', type: 'lang', regels: 2, verplicht: true,
        kop: 'Verwacht resultaat' },
      { k: 'werkelijk', label: 'Wat gebeurde er in plaats daarvan?', type: 'lang', regels: 3, verplicht: true,
        kop: 'Werkelijk resultaat' },
      { k: 'frequentie', label: 'Hoe vaak gebeurt het?', type: 'keuze', verplicht: true, kop: 'Frequentie',
        opties: ['altijd', 'soms', 'eenmalig'] },
      { k: 'hinder', label: 'Hoeveel hindert het je?', type: 'keuze', verplicht: true, kop: 'Impact',
        opties: ['blokkerend — ik kan niet verder', 'hinderlijk — ik kan eromheen werken', 'cosmetisch — alleen uiterlijk'] },
      { k: 'melder', label: 'Je naam', type: 'tekst', kop: 'Melder',
        hint: 'Optioneel, zodat we je kunnen bereiken bij vragen.' }
    ]
  },
  wijziging: {
    prefix: '[STORY]',
    jira: 'Story',
    knop: 'Verzoek versturen',
    velden: [
      { k: 'samenvatting', label: 'Korte omschrijving', type: 'tekst', verplicht: true,
        hint: 'Eén regel die de wens samenvat; dit wordt de titel in Jira.' },
      { k: 'rol', label: 'Als…', type: 'tekst', verplicht: true,
        hint: 'In welke rol heb je dit nodig? Bijvoorbeeld: medewerker die declareert.' },
      { k: 'wens', label: '…wil ik…', type: 'lang', regels: 3, verplicht: true,
        hint: 'Wat moet de app kunnen?' },
      { k: 'waarde', label: '…zodat…', type: 'lang', regels: 2, verplicht: true,
        hint: 'Wat levert het je op? Dit bepaalt vaak de prioriteit.' },
      { k: 'criteria', label: 'Acceptatiecriteria', type: 'lang', regels: 4, kop: 'Acceptatiecriteria',
        hint: 'Optioneel. Waaraan moet het voldoen om af te zijn? Eén per regel.' },
      { k: 'urgentie', label: 'Hoe urgent is het?', type: 'keuze', verplicht: true, kop: 'Urgentie',
        opties: ['kan wachten', 'graag binnenkort', 'nodig voor mijn werk'] },
      { k: 'melder', label: 'Je naam', type: 'tekst', kop: 'Aanvrager',
        hint: 'Optioneel, zodat we je kunnen bereiken bij vragen.' }
    ]
  }
};

/* Ingevulde waarden blijven staan als je tussendoor naar een ander scherm gaat. */
const meldInvoer = { bug: {}, wijziging: {} };
let meldVorigeView = 'maand';   /* scherm waar de gebruiker vandaan kwam — gaat mee als context */

const MELD_VIEWNAAM = {
  maand: 'Maand', overzicht: 'Overzicht', locaties: 'Locaties', instellingen: 'Instellingen',
  handleiding: 'Handleiding', nieuws: 'Nieuws', over: 'Over deze app', welkom: 'Welkom'
};

/* Vanuit gaNaar(): onthoud het scherm waar de melding vandaan komt. */
function meldOnthoudView(nieuw) {
  if ((nieuw === 'bug' || nieuw === 'wijziging') && ui.view !== 'bug' && ui.view !== 'wijziging') {
    meldVorigeView = ui.view;
  }
}

/* --- technische context: dit is alles wat de app zelf meestuurt --- */
function meldBrowser() {
  const ua = navigator.userAgent || '';
  const merken = [[/Edg\/(\d+)/, 'Edge'], [/OPR\/(\d+)/, 'Opera'], [/Firefox\/(\d+)/, 'Firefox'],
                  [/Chrome\/(\d+)/, 'Chrome'], [/Version\/(\d+).*Safari/, 'Safari']];
  let naam = 'onbekend';
  for (let i = 0; i < merken.length; i++) {
    const m = ua.match(merken[i][0]);
    if (m) { naam = merken[i][1] + ' ' + m[1]; break; }
  }
  let os = 'onbekend';
  if (/Windows NT 10/.test(ua)) os = 'Windows 10/11';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';
  return naam + ' op ' + os;
}
function meldTijdstip() {
  const d = new Date();
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* oude browser */ }
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
         pad(d.getHours()) + ':' + pad(d.getMinutes()) + (tz ? ' (' + tz + ')' : '');
}
function meldOpslagModus() {
  if (D.settings.opslagModus === 'onedrive') return 'OneDrive (meerdere apparaten)';
  return opslag.handle ? 'eigen bestand op dit apparaat' : 'alleen de kopie in deze browser';
}
function meldContext() {
  const v = (APP_VERSIE && APP_VERSIE.versie) || '?';
  const dat = (APP_VERSIE && APP_VERSIE.datum) || '?';
  return [
    ['App-versie', v + ' (' + dat + ')'],
    ['Omgeving', MELD_OMGEVING],
    ['Opslagmodus', meldOpslagModus()],
    ['Scherm in app', MELD_VIEWNAAM[meldVorigeView] || meldVorigeView],
    ['Browser', meldBrowser()],
    ['Schermformaat', screen.width + ' × ' + screen.height +
                      ' (venster ' + window.innerWidth + ' × ' + window.innerHeight + ')'],
    ['Tijdstip', meldTijdstip()],
    ['User agent', navigator.userAgent || 'onbekend']
  ];
}

/* --- de melding als platte tekst; *vet* rendert ook als Jira-opmaak --- */
function meldTekst(soort) {
  const def = MELDSOORTEN[soort];
  const inv = meldInvoer[soort];
  const regels = ['Type: ' + def.jira, 'Titel: ' + (inv.samenvatting || '').trim(), ''];
  if (soort === 'wijziging') {
    regels.push('*User story*',
      'Als ' + (inv.rol || '').trim() +
      ' wil ik ' + (inv.wens || '').trim().replace(/\s+/g, ' ') +
      ' zodat ' + (inv.waarde || '').trim().replace(/\s+/g, ' '), '');
  }
  def.velden.forEach(veld => {
    if (!veld.kop) return;                                   /* samenvatting staat al in de titel */
    const w = (inv[veld.k] || '').trim();
    if (!w) return;                                          /* lege optionele velden weglaten */
    regels.push('*' + veld.kop + '*', w, '');
  });
  regels.push('*Technische context (automatisch meegestuurd)*');
  const ctx = meldContext();
  const breed = Math.max.apply(null, ctx.map(r => r[0].length));
  ctx.forEach(r => regels.push(r[0] + ':' + ' '.repeat(breed - r[0].length + 1) + r[1]));
  regels.push('', 'Er zijn geen gegevens uit de kilometeradministratie meegestuurd.');
  return regels.join('\n');
}

/* --- formulier --- */
function meldVeldHtml(soort, veld, waarde) {
  const id = 'meld-' + soort + '-' + veld.k;
  const label = esc(veld.label) + (veld.verplicht ? ' <span style="color:var(--merk)">*</span>' : '');
  let invoer;
  if (veld.type === 'lang') {
    invoer = '<textarea id="' + id + '" data-meld="' + veld.k + '" rows="' + (veld.regels || 3) + '">' +
             esc(waarde) + '</textarea>';
  } else if (veld.type === 'keuze') {
    invoer = '<select id="' + id + '" data-meld="' + veld.k + '">' +
      '<option value="">— kies —</option>' +
      veld.opties.map(o => '<option value="' + esc(o) + '"' + (o === waarde ? ' selected' : '') + '>' +
                           esc(o) + '</option>').join('') + '</select>';
  } else {
    invoer = '<input type="text" id="' + id + '" data-meld="' + veld.k + '" autocomplete="off" value="' +
             esc(waarde) + '">';
  }
  return '<div class="field" style="max-width:620px;margin-bottom:14px">' +
         '<label for="' + id + '">' + label + '</label>' + invoer +
         (veld.hint ? '<span class="muted" style="font-size:12px">' + esc(veld.hint) + '</span>' : '') +
         '</div>';
}

function tekenMeldForm(soort) {
  const def = MELDSOORTEN[soort];
  const host = $('#meldForm-' + soort);
  if (!def || !host) return;
  const inv = meldInvoer[soort];
  if (inv.melder == null) inv.melder = (D.settings.naam || '').trim();   /* naam uit Instellingen voorvullen */

  const ctxRegels = meldContext()
    .map(r => '<div><span class="muted">' + esc(r[0]) + ':</span> ' + esc(r[1]) + '</div>').join('');
  const geenMail = !meldMail(soort);

  host.innerHTML =
    (geenMail
      ? '<div class="banner info" style="margin:0 0 16px">Het Jira-mailadres is in deze versie nog niet ingesteld. ' +
        'Je kunt de melding wel opstellen en met <strong>Kopieer melding</strong> naar het klembord zetten.</div>'
      : '') +
    def.velden.map(v => meldVeldHtml(soort, v, inv[v.k] || '')).join('') +
    '<details style="max-width:620px;margin:4px 0 16px">' +
    '<summary style="cursor:pointer;font-size:12.5px;font-weight:650">Wat stuurt de app automatisch mee?</summary>' +
    '<div style="margin-top:8px;font-size:12.5px;line-height:1.7;word-break:break-word">' + ctxRegels + '</div>' +
    '<div class="muted" style="margin-top:8px;font-size:12px">Er gaan geen ritten, locaties, adressen of bedragen mee.</div>' +
    '</details>' +
    '<div class="row" style="flex-wrap:wrap;gap:8px">' +
    (geenMail ? '' : '<button class="btn primary" data-meldactie="verstuur">' + esc(def.knop) + '</button>') +
    '<button class="btn" data-meldactie="kopieer">Kopieer melding</button>' +
    '<button class="btn ghost" data-meldactie="leeg">Formulier leegmaken</button>' +
    '</div>';

  host.querySelectorAll('[data-meld]').forEach(el => {
    const h = e => { inv[e.target.dataset.meld] = e.target.value; };
    el.oninput = h; el.onchange = h;
  });
}

/* Ontbrekende verplichte velden; geeft de labels terug en zet de focus op de eerste. */
function meldOntbreekt(soort) {
  const def = MELDSOORTEN[soort];
  const inv = meldInvoer[soort];
  const mist = def.velden.filter(v => v.verplicht && !String(inv[v.k] || '').trim());
  if (mist.length) {
    const el = $('#meld-' + soort + '-' + mist[0].k);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
  return mist.map(v => v.label.replace(/…$/, ''));
}

async function meldNaarKlembord(tekst) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(tekst); return true; }
  } catch (e) { /* valt terug op de oude methode */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = tekst;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

function meldOnderwerp(soort) {
  return MELDSOORTEN[soort].prefix + ' ' + String(meldInvoer[soort].samenvatting || '').trim();
}

async function verstuurMelding(soort) {
  const mist = meldOntbreekt(soort);
  if (mist.length) { toast('Vul nog in: ' + mist.join(', '), true); return; }
  const tekst = meldTekst(soort);
  const adres = meldMail(soort);
  const url = 'mailto:' + encodeURIComponent(adres) +
              '?subject=' + encodeURIComponent(meldOnderwerp(soort)) +
              '&body=' + encodeURIComponent(tekst);
  if (url.length > MELD_MAILTO_MAX) {
    /* Te lang voor een mailto-link: dan het klembord, anders opent de mail half afgekapt. */
    const ok = await meldNaarKlembord(tekst);
    await keuze('Melding is te lang voor de mailclient',
      (ok ? 'De melding staat op je klembord. ' : '') +
      'Stuur hem als mail naar ' + adres + ' met als onderwerp: ' + meldOnderwerp(soort) +
      (ok ? '' : ' (kopiëren lukte niet — selecteer de tekst in het formulier en kopieer die handmatig).'),
      [{ k: 'ok', label: 'Duidelijk', primair: true }]);
    return;
  }
  location.href = url;
  toast('Je mailprogramma opent met de melding — verstuur hem daar om hem in Jira te zetten');
}

async function kopieerMelding(soort) {
  const mist = meldOntbreekt(soort);
  if (mist.length) { toast('Vul nog in: ' + mist.join(', '), true); return; }
  const tekst = meldOnderwerp(soort) + '\n\n' + meldTekst(soort);
  toast(await meldNaarKlembord(tekst)
    ? 'Melding gekopieerd naar het klembord'
    : 'Kopiëren lukte niet in deze browser', false);
}

function leegMelding(soort) {
  meldInvoer[soort] = {};
  tekenMeldForm(soort);
  toast('Formulier leeggemaakt');
}

['bug', 'wijziging'].forEach(soort => {
  const host = $('#meldForm-' + soort);
  if (!host) return;
  host.addEventListener('click', e => {
    const b = e.target.closest('[data-meldactie]');
    if (!b) return;
    if (b.dataset.meldactie === 'verstuur') verstuurMelding(soort);
    if (b.dataset.meldactie === 'kopieer') kopieerMelding(soort);
    if (b.dataset.meldactie === 'leeg') leegMelding(soort);
  });
});
