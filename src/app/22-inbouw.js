/* ============================================================
   Inbouwstand: de module draait in een kader binnen een portaal (VSA)

   Aan te zetten met ?inbouw=vsa. Buiten die stand verandert er niets aan de
   losse app. De module bewaart in deze stand niets zelf: hij vraagt zijn
   gegevens bij de start aan de omringende pagina en geeft ze bij elke
   wijziging terug. Hij weet niets van het portaal, zijn inlog of zijn API —
   alleen van de berichten hieronder.

   Contract: zie docs/vsa-inbouwcontract-v1-reactie.md (v1.1).
   Uitgaand : gereed, bewaren, herladen, view
   Inkomend : laden, bewaard, conflict, fout, ga
   ============================================================ */
const INBOUW_CONTRACT = 1;
const INBOUW_DATAVERSIE = 1;      // hoogste documentformaat dat deze moduleversie kent (veld v)
const INBOUW_WACHT_MS = 10000;    // zo lang wachten we stil op het eerste laden

const INBOUW = {
  versie: null,          // versienummer van het document zoals het portaal het kent
  verwachtLaden: false,  // we hebben gereed/herladen gestuurd en wachten op antwoord
  geladen: false,        // het eerste laden is binnen
  locatie: false,        // mag de knop "Huidige locatie" gebruikt worden?
  conflictVersie: null,  // versienummer uit een openstaand conflict
  wachtTimer: null
};

function inbouwLocatieToegestaan() { return !!INBOUW.locatie; }

/* --- berichten versturen --- */
function inbouwStuur(bericht) {
  if (!INBOUW_AAN) return;
  bericht.km = 1;
  try { window.parent.postMessage(bericht, window.location.origin); }
  catch (e) { /* het portaal is weg; er is niets zinnigs meer te doen */ }
}

function inbouwMeldView(view) {
  if (!INBOUW_AAN) return;
  inbouwStuur({ type: 'view', view: view });
}

function inbouwBewaar(bron) {
  if (!INBOUW_AAN) return;
  inbouwStuur({ type: 'bewaren', data: D, versie: INBOUW.versie, bron: bron || 'bewerking' });
  zetStatus('bezig');
}

/* --- het scherm blokkeren tot het eerste laden binnen is ---
   Zonder deze grendel kan iemand bij een trage server alvast ritten intypen die
   even later door het binnenkomende laden worden overschreven. Wachten is
   vervelend; stilletjes werk kwijtraken is erger. */
function inbouwGrendel(aan, tekst) {
  let el = document.getElementById('inbouwGrendel');
  if (!aan) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.id = 'inbouwGrendel';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;' +
      'justify-content:center;background:var(--bg,#f6f6f7);text-align:center;padding:24px';
    document.body.appendChild(el);
  }
  el.innerHTML = '<div style="max-width:420px">' +
    '<div style="font-size:16px;font-weight:650;margin-bottom:6px">' + esc(tekst.titel) + '</div>' +
    '<div class="muted" style="font-size:13.5px;line-height:1.6">' + esc(tekst.uitleg) + '</div></div>';
}

/* --- inkomende berichten --- */
function inbouwOntvang(e) {
  if (e.source !== window.parent || e.origin !== window.location.origin) return;
  const b = e.data;
  if (!b || b.km !== 1 || typeof b.type !== 'string') return;    // onbekend of niet van ons: negeren
  switch (b.type) {
    case 'laden':    return inbouwLaden(b);
    case 'bewaard':  return inbouwBewaard(b);
    case 'conflict': return inbouwConflict(b);
    case 'fout':     return inbouwFout(b);
    case 'ga':       return inbouwGa(b);
    default:         return;                                      // onbekend type: negeren
  }
}

/* Een laden telt alleen als antwoord op ons eigen gereed of herladen. Zo kan een laat
   binnenkomend antwoord nooit werk overschrijven dat de gebruiker intussen deed. */
function inbouwLaden(b) {
  if (!INBOUW.verwachtLaden) return;
  INBOUW.verwachtLaden = false;
  INBOUW.conflictVersie = null;
  clearTimeout(INBOUW.wachtTimer);

  INBOUW.versie = (typeof b.versie === 'number') ? b.versie : null;
  INBOUW.locatie = b.locatie === true;                            // ontbreekt het veld: uit

  const binnen = b.data;
  if (binnen && geldigeData(binnen)) {
    D = binnen;
    D.settings = D.settings || defaultData().settings;
    D.maanden = D.maanden || {};
    D.afstanden = D.afstanden || {};
    D.locaties = D.locaties || [];
    D.gelezenBerichten = D.gelezenBerichten || [];
  } else {
    D = defaultData();
    D.ingericht = true;        // in het portaal is de inrichting al gedaan; geen welkomstscherm
  }
  D.settings.opslagModus = 'extern';
  migreer();                   // een ouder document van het portaal blijft werken na een nieuwe versie

  INBOUW.geladen = true;
  inbouwGrendel(false);
  opslag.naam = 'Ventus Slimme Assistent';
  zetStatus('ok');
  hertekenAlles();
  vulInstellingen();
  tekenOpslag();
}

function inbouwBewaard(b) {
  if (typeof b.versie === 'number') INBOUW.versie = b.versie;
  INBOUW.conflictVersie = null;
  zetStatus('ok');
}

/* Elders is eerder opgeslagen. Dezelfde keuzevraag als bij OneDrive: laden of forceren. */
async function inbouwConflict(b) {
  INBOUW.conflictVersie = (typeof b.versie === 'number') ? b.versie : null;
  zetStatus('fout', 'elders gewijzigd');
  const k = await keuze('Elders gewijzigd',
    'Je administratie is op een ander apparaat of tabblad aangepast sinds je laatste wijziging. ' +
    'Wil je die versie laden, of jouw huidige versie opslaan (dan vervalt de andere wijziging)?',
    [{ k: 'laden', label: 'Andere versie laden', primair: true }, { k: 'forceer', label: 'Mijn versie opslaan' }]);
  if (k === 'forceer') {
    /* Precies het versienummer uit het conflict terugsturen: dat is voor het portaal
       het teken van een bewuste keuze en overschrijft wat elders staat. */
    INBOUW.versie = INBOUW.conflictVersie;
    inbouwBewaar('bewerking');
    return;
  }
  inbouwHerlaad();
}

function inbouwHerlaad() {
  INBOUW.verwachtLaden = true;
  INBOUW.conflictVersie = null;
  inbouwStuur({ type: 'herladen' });
  zetStatus('bezig');
}

/* Opslaan mislukt. Nooit stil doorgaan: de gegevens blijven in beeld staan.
   Een document over de limiet is geen tijdelijke storing, dus dat krijgt een
   eigen uitweg in plaats van "probeer het opnieuw". */
function inbouwFout(b) {
  const melding = (typeof b.melding === 'string' && b.melding.trim())
    ? b.melding.trim() : 'Opslaan is mislukt.';
  zetStatus('fout', melding);
  if (b.reden === 'te-groot') {
    const m = openModal(
      '<header><h3>Je administratie is te groot geworden</h3></header>' +
      '<div class="body">' +
      '<p style="margin:0 0 10px">' + esc(melding) + '</p>' +
      '<p style="margin:0 0 10px">Je wijziging staat nog in beeld, maar kan zo niet worden opgeslagen. ' +
      'Opnieuw proberen helpt hier niet.</p>' +
      '<p style="margin:0"><strong>Wat je nu het beste doet:</strong> exporteer eerst de maanden die je ' +
      'nodig hebt via <em>Overzicht → Exporteer PDF of Excel</em>, en laat daarna afgesloten jaren ' +
      'opruimen. Je export blijft de administratie, dus daar gaat niets verloren.</p>' +
      '</div>' +
      '<footer><button class="btn primary" data-x="ok">Duidelijk</button></footer>');
    m.host.addEventListener('click', e => { if (e.target.closest('[data-x]')) m.close(); });
    return;
  }
  toast(melding, true);
}

function inbouwGa(b) {
  const toegestaan = ['maand', 'overzicht', 'locaties', 'instellingen'];
  if (toegestaan.indexOf(b.view) === -1) return;                  // andere waarden negeren
  gaNaar(b.view);
}

/* --- weergave aanpassen ---
   Verbergen, niet verwijderen: de code die deze onderdelen aanstuurt (zoals
   vulInstellingen) blijft dan gewoon werken. Welke onderdelen het betreft staat
   in styles.css onder .km-inbouw. */
function inbouwWeergave() {
  document.documentElement.classList.add('km-inbouw');
}

/* --- opstart --- */
function inbouwInit() {
  if (!INBOUW_AAN) return;
  inbouwWeergave();
  window.addEventListener('message', inbouwOntvang);

  INBOUW.verwachtLaden = true;
  inbouwGrendel(true, { titel: 'Je administratie wordt geladen…',
                        uitleg: 'Even geduld; je kunt invoeren zodra je gegevens binnen zijn.' });
  INBOUW.wachtTimer = setTimeout(() => {
    if (INBOUW.geladen) return;
    inbouwGrendel(true, { titel: 'Wachten op het portaal',
                          uitleg: 'Je administratie is nog niet geladen. Ververs de pagina als dit aanhoudt; ' +
                                  'er is niets verloren gegaan.' });
  }, INBOUW_WACHT_MS);

  inbouwStuur({ type: 'gereed', contract: INBOUW_CONTRACT,
                appVersie: APP_VERSIE.versie, dataVersie: INBOUW_DATAVERSIE });
}
