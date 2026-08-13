/* ============================================================
   OneDrive-opslag (Microsoft Graph) — optioneel, voor meerdere apparaten
   OAuth 2.0 Authorization Code + PKCE: geen server, geen client-secret.
   De data staat in de app-map van de gebruiker (/drive/special/approot),
   dus de app kan alleen bij zijn eigen bestand. Gelijktijdige apparaten
   worden afgevangen met de eTag van het bestand (If-Match → 412 bij conflict).
   ============================================================ */
const OD = {
  clientId: '',
  authority: 'https://login.microsoftonline.com/common',
  scopes: 'Files.ReadWrite.AppFolder offline_access openid profile',
  get redirect() { return location.origin + location.pathname; },  // exact deze pagina
  bestand: 'kilometerdeclaratie.json',
  token: null,     // { access, refresh, expires(ms) }
  etag: null,      // laatst bekende cTag van het bestand in OneDrive
  web: null,       // webUrl om het bestand in OneDrive te openen
  pad: null        // volledige map/pad in OneDrive (uit de metadata)
};
let odTimer = null;

/* --- PKCE-hulpjes (secure context / https vereist) --- */
function odB64url(buf) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function odRandom(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return odB64url(a.buffer); }
async function odSha256(s) { return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); }

/* --- token/etag bewaren (per omgeving geïsoleerd via STORE_KEY) --- */
function odBewaarToken() { try { localStorage.setItem(STORE_KEY + '.od.token', JSON.stringify(OD.token || null)); } catch (e) { /* optioneel */ } }
function odBewaarEtag() { try { OD.etag ? localStorage.setItem(STORE_KEY + '.od.etag', OD.etag) : localStorage.removeItem(STORE_KEY + '.od.etag'); } catch (e) { /* optioneel */ } }
function odLaadOpslag() {
  try { OD.token = JSON.parse(localStorage.getItem(STORE_KEY + '.od.token') || 'null'); } catch (e) { OD.token = null; }
  try { OD.etag = localStorage.getItem(STORE_KEY + '.od.etag') || null; } catch (e) { OD.etag = null; }
}

/* --- inloggen: stuur door naar Microsoft (redirect-flow, werkt ook mobiel) --- */
async function odLogin() {
  if (!OD.clientId) { toast('Vul eerst je Microsoft Client ID in', true); return; }
  if (!window.isSecureContext) { toast('Inloggen kan alleen op de https-versie van de app, niet op een lokaal bestand', true); return; }
  try {
    const verifier = odRandom(48);
    const challenge = odB64url(await odSha256(verifier));
    const state = odRandom(12);
    sessionStorage.setItem(STORE_KEY + '.od.pkce', JSON.stringify({ verifier, state }));
    const p = new URLSearchParams({
      client_id: OD.clientId, response_type: 'code', redirect_uri: OD.redirect,
      scope: OD.scopes, code_challenge: challenge, code_challenge_method: 'S256',
      state, response_mode: 'query', prompt: 'select_account'
    });
    location.assign(OD.authority + '/oauth2/v2.0/authorize?' + p.toString());
  } catch (e) { toast('Inloggen starten mislukt: ' + (e.message || e), true); }
}

/* --- terugkeer van Microsoft: ruil de code in voor tokens --- */
async function odAfhandelenRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return false;
  const schoon = location.origin + location.pathname;
  const bewaard = (() => { try { return JSON.parse(sessionStorage.getItem(STORE_KEY + '.od.pkce') || 'null'); } catch (e) { return null; } })();
  sessionStorage.removeItem(STORE_KEY + '.od.pkce');
  if (q.has('error')) { history.replaceState({}, '', schoon); toast('Inloggen bij Microsoft mislukt: ' + (q.get('error_description') || q.get('error')), true); return false; }
  if (!bewaard || bewaard.state !== q.get('state')) { history.replaceState({}, '', schoon); toast('Inlog-antwoord kwam niet overeen (state)', true); return false; }
  try {
    await odTokenRuil({ grant_type: 'authorization_code', code: q.get('code'), code_verifier: bewaard.verifier });
    history.replaceState({}, '', schoon);
    return true;
  } catch (e) { history.replaceState({}, '', schoon); toast('Token ophalen mislukt: ' + (e.message || e), true); return false; }
}

async function odTokenRuil(extra) {
  const body = new URLSearchParams(Object.assign({ client_id: OD.clientId, redirect_uri: OD.redirect, scope: OD.scopes }, extra));
  const r = await fetch(OD.authority + '/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error_description || ('HTTP ' + r.status));
  OD.token = { access: j.access_token, refresh: j.refresh_token || (OD.token && OD.token.refresh) || null, expires: Date.now() + ((j.expires_in || 3600) - 60) * 1000 };
  odBewaarToken();
}

/* geeft een geldig access-token terug, ververst zo nodig; null als opnieuw inloggen nodig is */
async function odGeldigToken() {
  if (OD.token && OD.token.access && Date.now() < OD.token.expires) return OD.token.access;
  if (OD.token && OD.token.refresh) {
    try { await odTokenRuil({ grant_type: 'refresh_token', refresh_token: OD.token.refresh }); return OD.token.access; }
    catch (e) { OD.token = null; odBewaarToken(); }
  }
  return null;
}

async function odGraph(pad, opt) {
  const tok = await odGeldigToken();
  if (!tok) throw new Error('niet ingelogd');
  opt = opt || {};
  const headers = Object.assign({ Authorization: 'Bearer ' + tok }, opt.headers || {});
  return fetch('https://graph.microsoft.com/v1.0' + pad, Object.assign({}, opt, { headers }));
}
const OD_PAD = () => '/me/drive/special/approot:/' + OD.bestand;
/* Leesbaar map+bestand-pad uit de Graph-metadata, bijv. /Apps/Kilometerdeclaratie/kilometerdeclaratie-test.json */
function odPadUit(item) {
  try {
    const p = (item && item.parentReference && item.parentReference.path) || '';
    const map = decodeURIComponent(p.replace(/^\/drive\/root:/, ''));
    return map + '/' + ((item && item.name) || OD.bestand);
  } catch (e) { return null; }
}

/* haal de administratie uit OneDrive; maakt het bestand aan als het nog niet bestaat */
async function odTrekBinnen(stil) {
  if (D.settings.opslagModus !== 'onedrive') return false;
  if (!(await odGeldigToken())) { zetStatus('verbinden'); odTekenStatus(); return false; }
  try {
    zetStatus('bezig');
    const meta = await odGraph(OD_PAD());
    if (meta.status === 404) { OD.etag = null; await odDuw(true); zetStatus('ok'); if (!stil) toast('OneDrive-bestand aangemaakt'); odTekenStatus(); return true; }
    if (!meta.ok) throw new Error('HTTP ' + meta.status);
    const mj = await meta.json();
    const inhoud = await odGraph(OD_PAD() + ':/content');
    if (!inhoud.ok) throw new Error('inhoud HTTP ' + inhoud.status);
    const j = await inhoud.json();
    if (!geldigeData(j)) throw new Error('het OneDrive-bestand bevat geen kilometeradministratie');
    D = j; D.maanden = D.maanden || {}; D.afstanden = D.afstanden || {}; D.locaties = D.locaties || [];
    migreer();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); } catch (e) { /* noodkopie is optioneel */ }
    OD.etag = mj.cTag || mj.eTag || null; odBewaarEtag();
    OD.web = mj.webUrl || OD.web; OD.pad = odPadUit(mj);
    uitBrowserkopie = false;
    hertekenAlles();
    zetStatus('ok'); odTekenStatus();
    if (!stil) toast('Gesynchroniseerd met OneDrive');
    return true;
  } catch (e) { zetStatus('fout', e.message || String(e)); odTekenStatus(); if (!stil) toast('OneDrive synchroniseren mislukt: ' + (e.message || e), true); return false; }
}

/* schrijf de administratie naar OneDrive met eTag-controle (If-Match) */
async function odDuw(stil) {
  if (D.settings.opslagModus !== 'onedrive') return false;
  if (!(await odGeldigToken())) { zetStatus('verbinden'); odTekenStatus(); return false; }
  try {
    zetStatus('bezig');
    const headers = { 'Content-Type': 'application/json' };
    if (OD.etag) headers['If-Match'] = OD.etag;
    let r = await odGraph(OD_PAD() + ':/content', { method: 'PUT', headers, body: JSON.stringify(D, null, 2) });
    if (r.status === 412) {   // elders gewijzigd sinds onze laatste sync
      const k = await keuze('OneDrive is elders gewijzigd',
        'Je administratie is op een ander apparaat aangepast sinds de laatste synchronisatie. ' +
        'Wil je die versie laden, of jouw huidige versie forceren (dan gaat de andere wijziging verloren)?',
        [{ k: 'laden', label: 'Andere versie laden', primair: true }, { k: 'forceer', label: 'Mijn versie opslaan' }]);
      if (k !== 'forceer') { await odTrekBinnen(true); return true; }
      const meta = await odGraph(OD_PAD()); const mj = meta.ok ? await meta.json() : null;
      OD.etag = mj ? (mj.cTag || mj.eTag) : null;
      const h2 = { 'Content-Type': 'application/json' }; if (OD.etag) h2['If-Match'] = OD.etag;
      r = await odGraph(OD_PAD() + ':/content', { method: 'PUT', headers: h2, body: JSON.stringify(D, null, 2) });
    }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const m = await r.json();
    OD.etag = m.cTag || m.eTag || null; odBewaarEtag();
    OD.web = m.webUrl || OD.web; OD.pad = odPadUit(m) || OD.pad;
    uitBrowserkopie = false;
    zetStatus('ok'); odTekenStatus();
    return true;
  } catch (e) { zetStatus('fout', e.message || String(e)); odTekenStatus(); if (!stil) toast('OneDrive opslaan mislukt: ' + (e.message || e), true); return false; }
}

function odUitloggen() {
  OD.token = null; OD.etag = null; odBewaarToken(); odBewaarEtag();
  zetStatus('verbinden'); odTekenStatus();
  toast('Uitgelogd bij OneDrive');
}

function odTekenStatus() {
  const modus = D.settings.opslagModus || 'lokaal';
  const sel = $('#odModus'); if (sel) sel.value = modus;
  const cfg = $('#odConfig'); if (cfg) cfg.classList.toggle('hidden', modus !== 'onedrive');
  const ci = $('#odClientId'); if (ci && document.activeElement !== ci) ci.value = D.settings.odClientId || '';
  const st = $('#odStatus'); if (!st) return;
  let msg, kl;
  if (!OD.clientId) { msg = 'Vul je Client ID in om te kunnen inloggen.'; kl = 'warn'; }
  else if (OD.token && OD.token.access) {
    msg = 'Ingelogd bij OneDrive.' + (opslag.status === 'ok' ? ' Laatst gesynchroniseerd.' : opslag.status === 'fout' ? ' Laatste sync mislukte — probeer “Nu synchroniseren”.' : '');
    kl = opslag.status === 'fout' ? 'err' : 'ok';
  } else { msg = 'Nog niet ingelogd bij Microsoft.'; kl = 'info'; }
  const detail = OD.pad ? esc(OD.pad) : esc(OD.bestand);
  const link = OD.web ? ' · <a href="' + esc(OD.web) + '" target="_blank" rel="noopener">openen in OneDrive</a>' : '';
  const bestandregel = '<div class="muted" style="font-size:12.5px;margin-top:6px">Deze omgeving slaat op in OneDrive-bestand: <strong>' + detail + '</strong>' + link + '</div>';
  st.innerHTML = '<div class="banner ' + kl + '" style="margin:0">' + esc(msg) + '</div>' + bestandregel;
}

function odToonHelp() {
  const uri = OD.redirect;
  const m = openModal(
    '<header><h3>OneDrive instellen (eenmalig)</h3></header>' +
    '<div class="body">' +
    '<p style="margin:0 0 10px">Je maakt één keer een gratis app-registratie aan; daarna kan iedereen met een Microsoft-account inloggen. Je hebt geen server of betaald abonnement nodig.</p>' +
    '<div class="banner warn" style="margin:0 0 12px">Gebruik je een <strong>persoonlijk</strong> Microsoft-account (hotmail/outlook/live) en krijg je “<em>toepassingen buiten een map maken is afgeschaft</em>”? Maak dan eerst gratis een map aan: ga naar <a href="https://entra.microsoft.com" target="_blank" rel="noopener">entra.microsoft.com</a> → <strong>Identity → Tenants beheren → Maken → Microsoft Entra ID</strong> (geen creditcard nodig), wissel naar die nieuwe map en ga daarna verder met stap 1.</div>' +
    '<ol style="margin:0 0 12px;padding-left:20px;line-height:1.6">' +
    '<li>Ga naar <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener">portal.azure.com → App-registraties</a> en klik <strong>Nieuwe registratie</strong>.</li>' +
    '<li>Naam: bijv. <em>Kilometerdeclaratie</em>. Bij <strong>Ondersteunde accounttypen</strong> kies je “<strong>Accounts in elke organisatiemap én persoonlijke Microsoft-accounts</strong>” — dat laat je met je eigen (hotmail-)account inloggen.</li>' +
    '<li>Bij <strong>Redirect-URI</strong>: kies platform <strong>Single-page application (SPA)</strong> en plak de URL hieronder.</li>' +
    '<li>Onder <strong>API-machtigingen</strong>: Microsoft Graph → <em>Gedelegeerd</em> → <code>Files.ReadWrite.AppFolder</code> (en <code>offline_access</code>).</li>' +
    '<li>Kopieer de <strong>Toepassings-id (client)</strong> en plak die in het veld “Microsoft Client ID”.</li>' +
    '</ol>' +
    '<p style="margin:0 0 6px;font-size:13px;color:var(--muted)">Redirect-URI voor deze omgeving (voeg ook je productie- en test-URL toe):</p>' +
    '<code style="display:block;padding:8px 10px;background:var(--surface-2);border:1px solid var(--border);border-radius:8px;word-break:break-all;font-size:12.5px">' + esc(uri) + '</code>' +
    '</div>' +
    '<footer><button class="btn primary" data-x="ok">Duidelijk</button></footer>');
  m.host.addEventListener('click', e => { if (e.target.closest('[data-x]')) m.close(); });
}

/* opstart: token laden, eventuele inlog-terugkeer afhandelen, en bij OneDrive-modus binnenhalen */
async function odInit() {
  OD.clientId = D.settings.odClientId || '';
  odLaadOpslag();
  const kwamTerug = await odAfhandelenRedirect();
  if (D.settings.opslagModus === 'onedrive') {
    opslag.naam = 'OneDrive · ' + OD.bestand;
    if (await odGeldigToken()) await odTrekBinnen(true);
    else zetStatus('verbinden');
  }
  odTekenStatus();
  if (kwamTerug) gaNaar('instellingen');
}

