# PDF-export — opmaak in de Ventus-huisstijl (v2.01)

De PDF die de app maakt volgt dezelfde vormgeving als de applicatie zelf.

## Opbouw van de pagina

1. **Rode kopbalk** over de volle breedte, op elke pagina herhaald: `VENTUS` in wit vet, daaronder
   `KILOMETERDECLARATIE` in kleine letterspatiëring. Rechts de maand en de naam van de gebruiker.
2. **Titel** — "Rittenadministratie zakelijke kilometers".
3. **Kopgegevens in een grijs paneel met een rode zijlijn**, in twee rijen van vier kolommen:
   naam, motor/auto, kenteken, maand, totaal kilometers, vergoeding per km en het totale
   declaratiebedrag. Dat laatste bedrag staat in de merkkleur.
4. **Tabel** met een rode kolomkop in wit, één regel per rit, en per dag samengevoegde cellen voor
   datum, dag, opmerking en dagtotaal. Weekenddagen staan grijs met een lichte achtergrond; elke nieuwe
   dag begint met een dunne scheidingslijn.
5. **Totaalregel** onderaan de tabel in lichtrood, met het maandtotaal rechts uitgelijnd. Die regel
   verschijnt alleen op de laatste pagina.
6. **Voettekst** met een dunne lijn: links "Ventus · Kilometerdeclaratie v<versie>", rechts
   "Pagina X van Y".

## Formaat en passing

Staand A4 met marges van 10 mm. De regelhoogte is zo afgestemd dat een volledige maand met twee ritten
per werkdag op één pagina past — juni 2026 (49 regels) vult de pagina precies. Bij meer ritten loopt de
tabel door naar een volgende pagina, met de rode kopbalk en de kolomkoppen herhaald.

## Kleuren

| gebruik | RGB |
| --- | --- |
| merkrood (kopbalk, tabelkop, bedrag) | 204, 0, 0 |
| lichtrood (totaalregel) | 253, 234, 234 |
| paneelgrijs | 246, 246, 247 |
| randen | 228, 228, 230 |
| tekst | 24, 24, 27 |
| grijze tekst / weekend | 107,107,115 en 154,154,162 |

Deze waarden staan in `app.js` in de constante `PDF_KLEUR`; de kopbalk wordt getekend in `pdfKopbalk`,
het paneel in `pdfPaneel` en `pdfKopgegevens`. Wie een andere merknaam of kleur wil, past die twee
plekken aan (naast `--merk` in de CSS voor de app zelf).

## Excel en het scherm-overzicht

De Excel-export houdt bewust de oorspronkelijke kolomopzet van de bestaande rittenadministratie aan
(bestemmingen naast elkaar per dag), zodat oude en nieuwe overzichten vergelijkbaar blijven. Het
tabblad Overzicht in de app volgt diezelfde opzet.
