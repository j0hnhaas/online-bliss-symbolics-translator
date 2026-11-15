# Bliss-Übersetzer · Online Blissymbolics Translator

Wandelt **deutschen oder englischen Text in Blissymbole** um. Alles läuft im Browser (statische Seite, ideal für GitHub Pages), das Vokabular stammt aus dem offiziellen **BCI Authorized Vocabulary (BCI-AV 2026-09-12)** mit 6551 Symbolen.

*English: a static, client-side web app that turns German or English text into Blissymbols using the official BCI-AV vocabulary.*

## Funktionen

- Eingabe auf Deutsch oder Englisch (Sprache wird automatisch erkannt oder von Hand gewählt)
- Grundformen-Suche mit eigenen Regeln für unregelmäßige Verben, Plural, Partizipien und deutsche Komposita (*Haustür* → Tür + Haus)
- **Grammatik-Indikatoren** nach den *BCI Fundamental Rules*: Plural, Vergangenheit, Zukunft; mittig über dem ersten Zeichen, bei hohen Zeichen höher gesetzt. Bei Verben wird der Handlungs-Indikator durch den Zeit-Indikator ersetzt
- Hilfsverben (*werde … gehen*, *habe … gesehen*, *will go*) werden zu Zeit-Indikatoren
- Klick auf ein Symbol zeigt alternative Bedeutungen (Mehrdeutigkeiten wie *gehen*, *essen*, *sein*)
- Abstände nach Regel 4.3.5 (Wortabstand, halber Abstand vor Satzzeichen)
- Export als **PNG** und **SVG**, Drucken, Teilen per Link (`#t=…&l=de`)
- Oberfläche auf Deutsch und Englisch
- **PWA**: installierbar (Android/Desktop-Chrome/Edge, iOS über „Zum Home-Bildschirm“) und offline nutzbar; ein Button lädt auf Wunsch alle Symbole (≈ 5 MB) für den Offline-Betrieb
- Optional: anonyme Besuchszählung mit [GoatCounter](https://www.goatcounter.com) (siehe unten)

## Aufbau

```
index.html          Seite
css/style.css       Gestaltung
js/app.js           Oberfläche, Export, Teilen
js/translate.js     Text → Symbol-Tokens (Wortsuche, Grammatik)
js/lemma.js         Grundformen für Deutsch und Englisch
js/layout.js        Zeilenumbruch, Indikator-Platzierung, SVG-Ausgabe
js/config.js        Einstellungen (GoatCounter-Code)
data/lexicon.json   Wort → Symbol-Index (aus BCI-AV erzeugt)
data/overrides.json Handverlesene Standardsymbole für häufige mehrdeutige Wörter
symbols/*.svg       Alle Symbole, zugeschnitten (nach BCI-AV-Nummer benannt)
tools/build.py      Erzeugt symbols/ und data/lexicon.json aus den BCI-AV-Dateien
tests/              Tests (node --test)
```

## GitHub Pages

*Settings → Pages → Deploy from a branch → `main` / `(root)`.* Es ist kein Build-Schritt nötig (`.nojekyll` ist gesetzt). Lokal testen:

```sh
python3 -m http.server 8000   # dann http://localhost:8000
npm test                      # Tests (Node ≥ 20)
```

## PWA / Offline

`sw.js` legt beim ersten Besuch die App-Dateien und das Wörterbuch in den Cache (Stale-while-revalidate: Änderungen kommen nach einem erneuten Laden an). Symbole werden beim ersten Anzeigen zwischengespeichert; der Button *Alle Symbole offline laden* holt alle 6551 auf einmal. Die Symbol-Caches heißen `bliss-symbols-v1`: **wenn sich `symbols/` ändert** (neues BCI-AV), den Namen in `sw.js` und in `js/app.js` (`SYMBOL_CACHE`) hochzählen. Der Service Worker läuft nur über HTTPS (GitHub Pages) oder `localhost`.

## GoatCounter einrichten

1. Konto auf goatcounter.com anlegen und eine Site anlegen, z. B. `bliss-translator` (erreichbar unter `https://bliss-translator.goatcounter.com`).
2. In `js/config.js` den Site-Code eintragen: `export const GOATCOUNTER = "bliss-translator";`
3. Committen und pushen. Solange der Code leer ist, wird nichts geladen und nichts gezählt.

Gezählt werden Seitenaufrufe sowie die Ereignisse *export-png*, *export-svg*, *print*, *copy-link* und *choose-alternative*. Der eingegebene Text wird **nicht** übertragen. Ein Hinweis im Seitenfuß erscheint automatisch, sobald GoatCounter aktiv ist.

## Vokabular neu erzeugen

Die Daten stammen von <https://blissymbolics.org> (Seite *BCI-AV*). Benötigt werden die Tabelle als CSV und `bliss_svg_id.zip`:

```sh
pip install lxml numpy pillow    # außerdem: rsvg-convert (librsvg)
python3 tools/build.py source/BCI-AV.csv source/bliss_svg_id.zip
```

Das Skript bereinigt die SVGs (Klassen werden zu Attributen, Zuschnitt, gemeinsame Grundlinie), ermittelt je Symbol Mitte und Oberkante des ersten Zeichens und baut den Wortindex. Veraltete Symbole (`OLD`, `SUPERSEDED`) werden nachrangig einsortiert, Indikatoren und Einzelbuchstaben nicht über Wörter gefunden.

## Grenzen

Die Zuordnung erfolgt **wortweise**. Das ist eine Lesehilfe und keine vollständige Übersetzung in die Bliss-Grammatik (Satzstellung, Passiv, Konjunktiv, Fälle usw. fehlen). Die Lemmatisierung ist regelbasiert und macht Fehler; über den Klick auf das Symbol lässt sich die Bedeutung korrigieren, und `data/overrides.json` nimmt weitere Standardwerte auf. Ideen für später: Wörterbuch-Lemmatisierung, weitere Indikatoren (Passiv, Konjunktiv, Adjektiv/Adverb), mehr Sprachen (die BCI-AV-Tabelle enthält 19), Satzstellung.

## Lizenz

- **Programmcode** (`js/`, `css/`, `tools/`, `tests/`, `index.html`, `data/overrides.json`): MIT, siehe [LICENSE](LICENSE).
- **Blissymbole und Vokabular** (`symbols/`, `data/lexicon.json`): © Blissymbolics Communication International (BCI), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Weitergabe nur mit Namensnennung und unter derselben Lizenz, siehe [LICENSE-DATA.md](LICENSE-DATA.md). Exportierte SVG-Dateien enthalten den Hinweis.

Dies ist kein offizielles Produkt von BCI.
