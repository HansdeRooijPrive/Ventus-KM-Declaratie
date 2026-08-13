/* ============================================================
   Export
   ============================================================ */
function bestandsnaam(ext) {
  const s = D.settings;
  const naam = (s.naam || 'rittenadministratie').replace(/[^\w\s-]/g, '').replace(/\s+/g, '');
  return ui.ym.replace('-', '') + '_' + naam + '_rittenadministratie.' + ext;
}

/* Telt ritten die als 0 km meetellen: onvolledige ritten (locatie ontbreekt) en
   ritten waarvan de afstand niet bepaald kon worden. */
function maandOnvolledig(ym) {
  let geenAfstand = 0, onvolledig = 0;
  for (const d of maandDagen(ym)) {
    const ritten = d.data ? d.data.ritten : [];
    for (const r of ritten) {
      if (!r.van || !r.naar) onvolledig++;
      else if (r.kmA == null) geenAfstand++;
    }
  }
  return { geenAfstand, onvolledig, totaal: geenAfstand + onvolledig };
}
/* Waarschuwt vóór de export als er ritten als 0 km meetellen: het declaratiebedrag
   zou dan te laag zijn zonder dat het opvalt. */
async function bevestigExport(ym) {
  const o = maandOnvolledig(ym);
  if (!o.totaal) return true;
  const delen = [];
  if (o.geenAfstand) delen.push(o.geenAfstand + ' rit(ten) zonder bepaalde afstand');
  if (o.onvolledig) delen.push(o.onvolledig + ' onvolledige rit(ten)');
  return await bevestig('Onvolledige ritten in ' + ymLabel(ym),
    'Let op: ' + delen.join(' en ') + ' in ' + ymLabel(ym) + '. Deze tellen als 0 km, ' +
    'waardoor het declaratiebedrag te laag kan zijn. Vul eerst de ontbrekende afstanden in, ' +
    'of exporteer toch?');
}

async function exportXlsx() {
  if (!window.XLSX) { toast('Excel-export is niet beschikbaar', true); return; }
  const ym = ui.ym;
  if (!(await bevestigExport(ym))) return;
  const s = maandInstellingen(ym), km = maandKm(ym), rate = Number(s.vergoeding) || 0;
  const { kop, rijen } = overzichtMatrix(ym);
  const aoa = [
    ['Naam', s.naam || '', '', 'Motor / auto', s.voertuig === 'motor' ? 'Motor' : 'Auto', 'Kenteken', s.kenteken || ''],
    ['Maand', ymLabel(ym), '', 'Maand Totaal km', km],
    ['Vergoeding/km', rate, '', 'Totaal in Euro', km * rate],
    [],
    kop
  ];
  rijen.forEach(r => aoa.push(r.rij));
  aoa.push([]);
  aoa.push(['', '', 'Totaal', km, '', '', '', '', 'Bedrag', km * rate]);
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = kop.map((k, i) => ({ wch: i === 0 ? 9 : i === 1 ? 11 : i === 2 ? 15 : /^Km/.test(k) ? 7 : 24 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, ymLabel(ym).slice(0, 28));
  XLSX.writeFile(wb, bestandsnaam('xlsx'));
  toast('Excel-bestand gedownload');
}

/* Voor de PDF krijgt iedere rit een eigen regel; datum, dag, opmerking en dagtotaal
   worden samengevoegd over de regels van dezelfde dag. */
function pdfRijen(ym) {
  const rijen = [];
  for (const d of maandDagen(ym)) {
    const dag = d.data;
    const ritten = dag ? dag.ritten : [];
    const datum = pad(d.dag) + '/' + ym.split('-')[1];
    const dagnaam = WEEKDAGEN[d.dow];
    const opm = dag ? (dag.opmerking || '') : '';
    const totaal = dagKm(dag);
    if (!ritten.length) {
      rijen.push({ cellen: [datum, dagnaam, opm, '', '', '', ''], weekend: d.weekend, eersteVanDag: true });
      continue;
    }
    const n = ritten.length;
    ritten.forEach((r, i) => {
      const cellen = [];
      if (i === 0) {
        cellen.push({ content: datum, rowSpan: n });
        cellen.push({ content: dagnaam, rowSpan: n });
        cellen.push({ content: opm, rowSpan: n });
      }
      cellen.push(locKort(locById(r.van)));
      cellen.push(locKort(locById(r.naar)));
      cellen.push(r.kmA == null ? '' : String(r.kmA));
      if (i === 0) cellen.push({ content: totaal ? String(totaal) : '', rowSpan: n, styles: { fontStyle: 'bold' } });
      rijen.push({ cellen: cellen, weekend: d.weekend, eersteVanDag: i === 0 });
    });
  }
  return rijen;
}

/* Kleuren van de huisstijl, in RGB voor de PDF */
const PDF_KLEUR = {
  merk: [204, 0, 0],
  merkDonker: [168, 0, 0],
  merkZacht: [253, 234, 234],
  paneel: [246, 246, 247],
  rand: [228, 228, 230],
  tekst: [24, 24, 27],
  grijs: [107, 107, 115],
  licht: [154, 154, 162]
};

function hoofdletter(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

/* Rode balk met logo bovenaan elke pagina */
function pdfKopbalk(doc, s, ym) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor.apply(doc, PDF_KLEUR.merk);
  doc.rect(0, 0, W, 17, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold'); doc.setFontSize(12.5);
  doc.text('VENTUS', 10, 8.6);
  doc.setFont(undefined, 'normal'); doc.setFontSize(6.4);
  doc.setCharSpace(0.75);
  doc.text('KILOMETERDECLARATIE', 10, 12.8);
  doc.setCharSpace(0);
  doc.setFontSize(8.5);
  doc.text(hoofdletter(ymLabel(ym)) + '   ·   ' + (s.naam || ''), W - 10, 10.6, { align: 'right' });
  doc.setTextColor.apply(doc, PDF_KLEUR.tekst);
}

/* Grijs paneel met rode zijlijn, zoals de meldingen in de app */
function pdfPaneel(doc, x, y, w, h) {
  doc.setFillColor.apply(doc, PDF_KLEUR.paneel);
  doc.setDrawColor.apply(doc, PDF_KLEUR.rand);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h, 'FD');
  doc.setFillColor.apply(doc, PDF_KLEUR.merk);
  doc.rect(x, y, 1.5, h, 'F');
}

function pdfKopgegevens(doc, s, ym, km, rate) {
  const x = 10, y = 28, w = doc.internal.pageSize.getWidth() - 20, h = 26;
  pdfPaneel(doc, x, y, w, h);
  const velden = [
    ['Naam', s.naam || '—'],
    ['Motor / auto', s.voertuig === 'motor' ? 'Motor' : 'Auto'],
    ['Kenteken', s.kenteken || '—'],
    ['Maand', hoofdletter(ymLabel(ym))],
    ['Totaal kilometers', km + ' km'],
    ['Vergoeding per km', eur(rate)],
    ['Totaal declaratiebedrag', eur(km * rate)]
  ];
  const kolBreedte = (w - 14) / 4;
  velden.forEach((v, i) => {
    const kx = x + 7 + (i % 4) * kolBreedte;
    const ky = y + 7 + Math.floor(i / 4) * 12;
    doc.setFont(undefined, 'normal'); doc.setFontSize(5.9);
    doc.setTextColor.apply(doc, PDF_KLEUR.licht);
    doc.setCharSpace(0.35);
    doc.text(v[0].toUpperCase(), kx, ky);
    doc.setCharSpace(0);
    doc.setFont(undefined, 'bold'); doc.setFontSize(9);
    doc.setTextColor.apply(doc, i === velden.length - 1 ? PDF_KLEUR.merk : PDF_KLEUR.tekst);
    doc.text(String(v[1]), kx, ky + 4.6);
  });
  doc.setTextColor.apply(doc, PDF_KLEUR.tekst);
  return y + h;
}

async function exportPdf() {
  if (!window.jspdf) { toast('PDF-export is niet beschikbaar — gebruik Afdrukken → Opslaan als PDF', true); return; }
  const { jsPDF } = window.jspdf;
  const ym = ui.ym;
  if (!(await bevestigExport(ym))) return;
  const s = maandInstellingen(ym), km = maandKm(ym), rate = Number(s.vergoeding) || 0;
  const rijen = pdfRijen(ym);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();

  pdfKopbalk(doc, s, ym);
  doc.setFont(undefined, 'bold'); doc.setFontSize(14.5);
  doc.text('Rittenadministratie zakelijke kilometers', 10, 24.5);
  const naPaneel = pdfKopgegevens(doc, s, ym, km, rate);

  doc.autoTable({
    head: [['Datum', 'Dag', 'Opmerkingen', 'Van', 'Naar', 'Km', 'Dag km']],
    body: rijen.map(r => r.cellen),
    foot: [[{ content: 'Totaal ' + hoofdletter(ymLabel(ym)), colSpan: 6 }, String(km)]],
    startY: naPaneel + 5,
    margin: { left: 10, right: 10, top: 23, bottom: 13 },
    theme: 'plain',
    showFoot: 'lastPage',
    styles: {
      fontSize: 6.9, cellPadding: { top: 0.7, bottom: 0.7, left: 2, right: 2 },
      overflow: 'linebreak', valign: 'middle', textColor: PDF_KLEUR.tekst,
      lineColor: PDF_KLEUR.rand, lineWidth: 0
    },
    headStyles: {
      fillColor: PDF_KLEUR.merk, textColor: [255, 255, 255], fontSize: 6.6,
      fontStyle: 'bold', cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }
    },
    footStyles: {
      fillColor: PDF_KLEUR.merkZacht, textColor: PDF_KLEUR.merk, fontStyle: 'bold',
      fontSize: 8, halign: 'left', cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 19, textColor: PDF_KLEUR.grijs },
      2: { cellWidth: 24 },
      3: { cellWidth: 47 },
      4: { cellWidth: 47 },
      5: { cellWidth: 13, halign: 'right' },
      6: { cellWidth: 16, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: d => {
      if (d.section === 'foot' && d.column.index === 6) d.cell.styles.halign = 'right';
      if (d.section !== 'body') return;
      const rij = rijen[d.row.index];
      if (!rij) return;
      if (rij.weekend) { d.cell.styles.textColor = PDF_KLEUR.licht; d.cell.styles.fillColor = [250, 250, 250]; }
      if (rij.eersteVanDag) d.cell.styles.lineWidth = { top: 0.2, right: 0, bottom: 0, left: 0 };
    },
    didDrawPage: () => {
      pdfKopbalk(doc, s, ym);
      doc.setDrawColor.apply(doc, PDF_KLEUR.rand); doc.setLineWidth(0.2);
      doc.line(10, H - 11, W - 10, H - 11);
      doc.setFont(undefined, 'normal'); doc.setFontSize(7);
      doc.setTextColor.apply(doc, PDF_KLEUR.licht);
      doc.text('Ventus · Kilometerdeclaratie' +
        (typeof APP_VERSIE !== 'undefined' ? ' v' + APP_VERSIE.versie : ''), 10, H - 6.5);
      doc.text('Pagina ' + doc.internal.getNumberOfPages() + ' van {totaal}', W - 10, H - 6.5, { align: 'right' });
      doc.setTextColor.apply(doc, PDF_KLEUR.tekst);
    }
  });

  const y = doc.lastAutoTable.finalY + 7;
  if (y < H - 20) {
    doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, PDF_KLEUR.grijs);
    doc.text(km + ' km  ×  ' + eur(rate) + '  =  ' + eur(km * rate), W - 10, y, { align: 'right' });
    doc.setTextColor.apply(doc, PDF_KLEUR.tekst);
  }
  if (doc.putTotalPages) doc.putTotalPages('{totaal}');
  doc.save(bestandsnaam('pdf'));
  toast('PDF gedownload');
}

$('#btnExportXls').onclick = exportXlsx;
$('#btnExportPdf').onclick = exportPdf;
$('#btnExportXlsTop').onclick = exportXlsx;
$('#btnExportPdfTop').onclick = exportPdf;
$('#btnPrint').onclick = () => {
  $('#view-overzicht').classList.add('print-me');
  window.print();
  setTimeout(() => $('#view-overzicht').classList.remove('print-me'), 500);
};

