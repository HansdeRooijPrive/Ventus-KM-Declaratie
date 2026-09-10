/* ============================================================
   Opslag in een zelfgekozen bestand (File System Access API)
   ============================================================ */
const IDB_DB = 'kilometerdeclaratie', IDB_STORE = 'kv', IDB_KEY = 'opslagbestand';
let idbConn = null;
function idbOpen() {
  return new Promise((res, rej) => {
    if (idbConn) return res(idbConn);
    let q;
    try { q = indexedDB.open(IDB_DB, 1); } catch (e) { return rej(e); }
    q.onupgradeneeded = () => { if (!q.result.objectStoreNames.contains(IDB_STORE)) q.result.createObjectStore(IDB_STORE); };
    q.onsuccess = () => { idbConn = q.result; res(idbConn); };
    q.onerror = () => rej(q.error || new Error('lokale index niet beschikbaar'));
  });
}
async function idbZet(k, v) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction(IDB_STORE, 'readwrite');
    t.objectStore(IDB_STORE).put(v, k);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}
async function idbHaal(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const r = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(k);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbWis(k) {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const t = db.transaction(IDB_STORE, 'readwrite');
    t.objectStore(IDB_STORE).delete(k);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });
}

function zetStatus(status, melding) { opslag.status = status; opslag.melding = melding || ''; tekenOpslag(); }

async function rechten(handle, vragen) {
  const o = { mode: 'readwrite' };
  try {
    if ((await handle.queryPermission(o)) === 'granted') return 'granted';
    if (!vragen) return 'prompt';
    return await handle.requestPermission(o);
  } catch (e) { return 'fout'; }
}

function geldigeData(j) { return j && typeof j === 'object' && j.settings && Array.isArray(j.locaties); }

async function schrijfBestand(stil) {
  if (!opslag.handle) return false;
  if (opslag.bezig) { opslag.wachtend = true; return false; }
  opslag.bezig = true; zetStatus('bezig');
  try {
    if ((await rechten(opslag.handle, false)) !== 'granted') { zetStatus('verbinden'); return false; }
    if (!opslag.negeerExtern && opslag.laatsteSchrijf) {
      const f = await opslag.handle.getFile();
      if (f.lastModified > opslag.laatsteSchrijf + 2000) {
        const k = await keuze('Bestand buiten de app gewijzigd',
          'Het opslagbestand “' + opslag.naam + '” is sinds de laatste keer opslaan gewijzigd buiten deze app om — ' +
          'bijvoorbeeld door synchronisatie of doordat je het op een ander apparaat hebt bijgewerkt.',
          [{ k: 'laden', label: 'Bestand laden', primair: true }, { k: 'houden', label: 'Mijn versie opslaan' }]);
        if (k !== 'houden') { opslag.bezig = false; await laadUitBestand(); return true; }
        opslag.negeerExtern = true;
      }
    }
    const w = await opslag.handle.createWritable();
    await w.write(JSON.stringify(D, null, 2));
    await w.close();
    opslag.laatsteSchrijf = (await opslag.handle.getFile()).lastModified;
    opslag.negeerExtern = false;
    uitBrowserkopie = false;
    zetStatus('ok');
    return true;
  } catch (e) {
    zetStatus('fout', e.message || String(e));
    if (!stil) toast('Opslaan in het bestand mislukt: ' + (e.message || e), true);
    return false;
  } finally {
    opslag.bezig = false;
    if (opslag.wachtend) { opslag.wachtend = false; setTimeout(() => schrijfBestand(true), 60); }
  }
}

async function laadUitBestand(stil) {
  if (!opslag.handle) return false;
  try {
    if ((await rechten(opslag.handle, false)) !== 'granted') { zetStatus('verbinden'); return false; }
    const f = await opslag.handle.getFile();
    const tekst = await f.text();
    if (tekst.trim()) {
      const j = JSON.parse(tekst);
      if (!geldigeData(j)) throw new Error('dit bestand bevat geen kilometeradministratie');
      D = j;
      D.maanden = D.maanden || {}; D.afstanden = D.afstanden || {}; D.locaties = D.locaties || [];
      try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); } catch (e) { /* noodkopie is optioneel */ }
      hertekenAlles();
    }
    opslag.laatsteSchrijf = f.lastModified;
    opslag.negeerExtern = false;
    uitBrowserkopie = false;
    zetStatus('ok');
    if (!stil) toast('Geladen uit ' + opslag.naam);
    return true;
  } catch (e) {
    zetStatus('fout', e.message || String(e));
    if (!stil) toast('Lezen uit het bestand mislukt: ' + (e.message || e), true);
    return false;
  }
}

function hertekenAlles() {
  ui.open.clear();
  vergeetFavorieten();
  vulInstellingen(); tekenMaand(); tekenOverzicht(); tekenLocaties(); tekenNieuwsBadge();
}

const BESTAND_TYPES = [{ description: 'Kilometeradministratie', accept: { 'application/json': ['.json'] } }];

async function kiesOpslagBestand() {
  if (!heeftBestandsAPI) { toast('Deze browser kan niet rechtstreeks naar een bestand schrijven', true); return; }
  let h;
  try {
    h = await window.showSaveFilePicker({ suggestedName: 'Kilometerdeclaratie.json', types: BESTAND_TYPES });
  } catch (e) {
    if (e.name !== 'AbortError') toast('Kon geen bestand kiezen: ' + (e.message || e), true);
    return;
  }
  // Wijst de gebruiker een bestand aan waar al een administratie in staat, dan niet blind overschrijven
  try {
    const f = await h.getFile();
    if (f.size) {
      let aanwezig = null;
      try { aanwezig = JSON.parse(await f.text()); } catch (e) { /* geen leesbare json */ }
      if (geldigeData(aanwezig)) {
        const maanden = Object.keys(aanwezig.maanden || {}).length;
        const k = await keuze('Dit bestand bevat al een administratie',
          '“' + h.name + '” bevat al een kilometeradministratie (' + mv(maanden, 'maand', 'maanden') + ', ' +
          mv((aanwezig.locaties || []).length, 'locatie', 'locaties') + '). Wil je die openen, of het bestand ' +
          'overschrijven met wat er nu in de app staat?',
          [{ k: 'laden', label: 'Deze administratie openen', primair: true },
           { k: 'overschrijven', label: 'Overschrijven' },
           { k: 'nee', label: 'Annuleren' }]);
        if (!k || k === 'nee') return;
        if (k === 'laden') {
          opslag.handle = h; opslag.naam = h.name;
          try { await idbZet(IDB_KEY, h); } catch (e) { /* optioneel */ }
          await laadUitBestand();
          return;
        }
      }
    }
  } catch (e) { /* lezen mislukt: gewoon als nieuw bestand gebruiken */ }

  opslag.handle = h; opslag.naam = h.name; opslag.laatsteSchrijf = 0; opslag.negeerExtern = true;
  try { await idbZet(IDB_KEY, h); } catch (e) { /* handle onthouden is optioneel */ }
  if (await schrijfBestand()) toast('Je administratie wordt nu opgeslagen in ' + h.name);
}

async function openOpslagBestand() {
  if (typeof window.showOpenFilePicker !== 'function') { toast('Deze browser ondersteunt bestanden openen niet', true); return; }
  let h;
  try {
    const gekozen = await window.showOpenFilePicker({ multiple: false, types: BESTAND_TYPES });
    h = gekozen[0];
  } catch (e) {
    if (e.name !== 'AbortError') toast('Kon geen bestand openen: ' + (e.message || e), true);
    return;
  }
  const vorige = { handle: opslag.handle, naam: opslag.naam };
  opslag.handle = h; opslag.naam = h.name;
  if ((await rechten(h, true)) !== 'granted') {
    opslag.handle = vorige.handle; opslag.naam = vorige.naam;
    toast('Geen toestemming gekregen voor dit bestand', true); tekenOpslag(); return;
  }
  if (await laadUitBestand()) {
    try { await idbZet(IDB_KEY, h); } catch (e) { /* optioneel */ }
  } else {
    opslag.handle = vorige.handle; opslag.naam = vorige.naam; tekenOpslag();
  }
}

async function verbindOpnieuw() {
  if (!opslag.handle) return;
  if ((await rechten(opslag.handle, true)) !== 'granted') {
    zetStatus('geweigerd');
    toast('De browser gaf geen toegang tot het bestand', true);
    return;
  }
  await laadUitBestand();
}

async function ontkoppelBestand() {
  const ok = await bevestig('Opslagbestand ontkoppelen',
    'De app slaat daarna alleen nog op in deze browser. Het bestand zelf blijft ongewijzigd staan.');
  if (!ok) return;
  opslag.handle = null; opslag.naam = null; opslag.laatsteSchrijf = 0;
  try { await idbWis(IDB_KEY); } catch (e) { /* optioneel */ }
  zetStatus('browser');
}

async function herstelOpslagbestand() {
  let h = null;
  try { h = await idbHaal(IDB_KEY); } catch (e) { zetStatus('browser'); return; }
  if (!h) { zetStatus('browser'); return; }
  opslag.handle = h; opslag.naam = h.name;
  if ((await rechten(h, false)) === 'granted') await laadUitBestand(true);
  else zetStatus('verbinden');
}

/* --- weergave van de opslagstatus --- */
let bannerVerborgen = false;

function opslagPaneelHtml() {
  if (D.settings.opslagModus === 'onedrive') {
    const sub = { ok: 'Gesynchroniseerd met OneDrive', bezig: 'Bezig met synchroniseren…', verbinden: 'Nog niet ingelogd bij Microsoft', fout: 'Laatste sync mislukte: ' + opslag.melding }[opslag.status] || 'OneDrive-opslag';
    return '<div class="opslag-info"><span class="ico">☁️</span><div>' +
      '<div class="bestand">OneDrive · ' + esc(OD.bestand) + '</div>' +
      '<div class="sub">' + esc(sub) + (OD.web ? ' · <a href="' + esc(OD.web) + '" target="_blank" rel="noopener">openen</a>' : '') + '</div></div></div>';
  }
  if (!heeftBestandsAPI) {
    return '<div class="banner err" style="margin:0">Deze browser kan niet rechtstreeks naar een bestand op je computer schrijven. ' +
      'Gebruik Chrome of Edge op de computer, of werk met “Back-up downloaden” hieronder.</div>';
  }
  if (!opslag.handle) {
    return '<div class="opslag-info"><span class="ico">💾</span><div>' +
      '<div class="bestand">Nog geen opslagbestand gekozen</div>' +
      '<div class="sub">Je administratie staat nu alleen in deze browser.</div></div></div>';
  }
  const t = opslag.laatsteSchrijf ? new Date(opslag.laatsteSchrijf).toLocaleString('nl-NL') : '—';
  const sub = {
    ok: 'Laatst opgeslagen: ' + t,
    bezig: 'Bezig met opslaan…',
    verbinden: 'De verbinding met dit bestand moet hersteld worden',
    geweigerd: 'De browser gaf geen toegang tot dit bestand',
    fout: 'Laatste poging mislukt: ' + opslag.melding
  }[opslag.status] || '';
  return '<div class="opslag-info"><span class="ico">📄</span><div>' +
    '<div class="bestand">' + esc(opslag.naam) + '</div>' +
    '<div class="sub">' + esc(sub) + '</div></div></div>';
}

function tekenOpslag() {
  const pill = $('#opslagPill'), tekst = $('#opslagPillTekst');
  if (pill) {
    const kl = { ok: 'ok', bezig: 'busy', verbinden: 'warn', geweigerd: 'err', fout: 'err', browser: 'warn' }[opslag.status] || '';
    pill.className = 'opslag-pill ' + kl;
    if (D.settings.opslagModus === 'onedrive') {
      tekst.textContent = 'OneDrive · ' + OD.bestand;
      const staat = { ok: ' — gesynchroniseerd', bezig: ' — bezig met opslaan…', verbinden: ' — nog niet ingelogd', fout: ' — laatste sync mislukte' }[opslag.status] || '';
      pill.title = 'OneDrive-bestand: ' + (OD.pad || OD.bestand) + staat;
    } else {
      tekst.textContent = {
        ok: opslag.naam || 'Opgeslagen',
        bezig: 'Opslaan…',
        verbinden: 'Verbinding herstellen',
        geweigerd: 'Geen toegang',
        fout: 'Opslaan mislukt',
        browser: 'Alleen in deze browser'
      }[opslag.status] || 'Opslag';
      pill.title = opslag.handle ? 'Opslaglocatie: ' + opslag.naam : 'Nog geen opslagbestand gekozen';
    }
  }

  const b = $('#opslagBanner');
  if (b) {
    let inhoud = '', klasse = 'banner';
    if (heeftBestandsAPI && opslag.status === 'verbinden') {
      inhoud = '<span class="grow">Klik op <strong>Verbinden</strong> om verder te gaan met <strong>' + esc(opslag.naam) +
        '</strong>, of open een ander bestand met je administratie.</span>' +
        '<button class="btn sm primary" data-act="verbind">Verbinden</button>' +
        '<button class="btn sm" data-act="open">Ander bestand openen…</button>';
    } else if (heeftBestandsAPI && opslag.status === 'geweigerd') {
      klasse += ' err';
      inhoud = '<span class="grow">Geen toegang tot <strong>' + esc(opslag.naam) + '</strong>. Verbind opnieuw of open een ander bestand.</span>' +
        '<button class="btn sm primary" data-act="verbind">Opnieuw proberen</button>' +
        '<button class="btn sm" data-act="open">Bestaand bestand openen…</button>' +
        '<button class="btn sm" data-act="kies">Nieuw bestand maken…</button>';
    } else if (heeftBestandsAPI && opslag.status === 'fout') {
      klasse += ' err';
      inhoud = '<span class="grow">Opslaan in <strong>' + esc(opslag.naam || 'het bestand') + '</strong> mislukte: ' + esc(opslag.melding) + '</span>' +
        '<button class="btn sm primary" data-act="nu">Opnieuw opslaan</button>';
    } else if (heeftBestandsAPI && !opslag.handle && !bannerVerborgen && D.settings.opslagModus !== 'onedrive') {
      const heeftInhoud = D.locaties.length || Object.keys(D.maanden).length;
      klasse += ' info';
      inhoud = '<span class="grow">' + (uitBrowserkopie && heeftInhoud
        ? 'Wat je hier ziet komt uit de <strong>kopie in deze browser</strong> van een eerdere sessie — er is nog ' +
          'geen opslagbestand gekoppeld. Open je eigen bestand, of begin met een lege administratie.'
        : 'Je administratie staat nu alleen in deze browser. Maak een opslagbestand op je computer, ' +
          'netwerkschijf of in een OneDrive-map — of open een bestand dat je eerder hebt gemaakt.') + '</span>' +
        '<button class="btn sm primary" data-act="open">Bestaand bestand openen…</button>' +
        '<button class="btn sm" data-act="kies">Nieuw bestand maken…</button>' +
        (uitBrowserkopie && heeftInhoud ? '<button class="btn sm ghost" data-act="opnieuw">Opnieuw beginnen</button>' : '') +
        '<button class="btn sm ghost" data-act="sluit">Later</button>';
    }
    b.className = klasse + (inhoud ? '' : ' hidden');
    b.innerHTML = inhoud;
  }

  const paneel = $('#opslagStatus');
  if (paneel) paneel.innerHTML = opslagPaneelHtml();
  tekenSaveHint();
}

$('#opslagBanner').addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'verbind') verbindOpnieuw();
  if (a === 'kies') kiesOpslagBestand();
  if (a === 'open') openOpslagBestand();
  if (a === 'opnieuw') opnieuwBeginnen();
  if (a === 'nu') schrijfBestand();
  if (a === 'sluit') { bannerVerborgen = true; tekenOpslag(); }
});
$('#opslagPill').onclick = () => gaNaar('instellingen');

/* Bestand kan buiten de app zijn gewijzigd (synchronisatie, ander apparaat). */
let focusBezig = false;
window.addEventListener('focus', async () => {
  if (!opslag.handle || focusBezig || opslag.status !== 'ok') return;
  focusBezig = true;
  try {
    const f = await opslag.handle.getFile();
    if (f.lastModified > opslag.laatsteSchrijf + 2000) {
      const k = await keuze('Bestand buiten de app gewijzigd',
        'Het opslagbestand “' + opslag.naam + '” is gewijzigd buiten deze app om. Wil je die versie laden?',
        [{ k: 'laden', label: 'Bestand laden', primair: true }, { k: 'houden', label: 'Mijn versie houden' }]);
      if (k === 'laden') await laadUitBestand();
      else if (k === 'houden') { opslag.negeerExtern = true; opslag.laatsteSchrijf = f.lastModified; }
    }
  } catch (e) { /* niet storend melden */ }
  focusBezig = false;
});

