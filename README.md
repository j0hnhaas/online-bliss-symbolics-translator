# Bliss-Übersetzer · Online Blissymbolics Translator

Wandelt **Text in Blissymbole** um: Deutsch, Englisch, Französisch, Spanisch, Italienisch, Portugiesisch und Esperanto. Alles läuft im Browser (statische Seite, ideal für GitHub Pages), das Vokabular stammt aus dem offiziellen **BCI Authorized Vocabulary (BCI-AV 2026-09-12)** mit 6551 Symbolen.

*English: a static, client-side web app that turns German, English, French, Spanish, Italian, Portuguese or Esperanto text into Blissymbols using the official BCI-AV vocabulary.*

## Funktionen

- Eingabe auf Deutsch, Englisch, Französisch, Spanisch, Italienisch, Portugiesisch oder Esperanto (Sprache wird automatisch erkannt oder von Hand gewählt; die Wortlisten der weiteren Sprachen werden erst bei Bedarf geladen)
- Grundformen-Suche mit eigenen Regeln je Sprache: unregelmäßige Verben, Plural, Feminin, Partizipien, Kürzungen und Verschmelzungen (*j'ai*, *del*, *dell'*, *do*, *don't*), deutsche Komposita (*Haustür* → Tür + Haus), Esperanto-Endungen und x-/h-System, Suche ohne Akzente
- **Grammatik-Indikatoren** nach den *BCI Fundamental Rules*: Plural, Vergangenheit, Zukunft; mittig über dem ersten Zeichen, bei hohen Zeichen höher gesetzt. Bei Verben wird der Handlungs-Indikator durch den Zeit-Indikator ersetzt
- Hilfsverben und Zeitformen werden zu Zeit-Indikatoren: *werde … gehen*, *habe … gesehen*, *will go*, *j'ai vu*, *vais manger*, *ha comido*, *voy a beber*, *berremo*, *tenho comido*, *trinkos*, *manĝinta*
- Klick auf ein Symbol zeigt alternative Bedeutungen (Mehrdeutigkeiten wie *gehen*, *essen*, *sein*)
- Abstände nach Regel 4.3.5 (Wortabstand, halber Abstand vor Satzzeichen)
- Bildexport (PNG), Drucken, Link teilen (`#t=…&l=de`; auf dem Handy über das System-Teilen-Menü)
- Oberfläche auf Deutsch und Englisch
- **PWA**: installierbar (Android/Desktop-Chrome/Edge, iOS über „Zum Home-Bildschirm“) und offline nutzbar; ein Button lädt auf Wunsch alle Symbole und Sprachen (≈ 7 MB) für den Offline-Betrieb
- Optional: anonyme Besuchszählung mit [GoatCounter](https://www.goatcounter.com) (siehe unten)

## Aufbau

```
index.html          Seite
css/style.css       Gestaltung
js/app.js           Oberfläche, Export, Teilen
js/translate.js     Text → Symbol-Tokens (Wortsuche, Grammatik)
js/langs/           Ein Modul je Sprache (de, en, fr, es, it, pt, eo): Grundformen, Kürzungen, Hilfsverben; index.js beschreibt die Schnittstelle
js/layout.js        Zeilenumbruch, Indikator-Platzierung, SVG-Ausgabe
js/config.js        Einstellungen (GoatCounter-Code)
data/symbols.json  Symbol-Metriken (Wortart, Breite, Mitte, Oberkante), Basis-Symbole für Zeit-Indikatoren
data/lang/*.json    Wort → Symbol-Index je Sprache (aus BCI-AV erzeugt, wird bei Bedarf geladen)
data/overrides.json Handverlesene Standardsymbole für häufige mehrdeutige Wörter
symbols/*.svg       Alle Symbole, zugeschnitten (nach BCI-AV-Nummer benannt)
tools/build.py      Erzeugt symbols/, data/symbols.json und data/lang/*.json aus den BCI-AV-Dateien
tests/              Tests (node --test)
```

## GitHub Pages

*Settings → Pages → Deploy from a branch → `main` / `(root)`.* Es ist kein Build-Schritt nötig (`.nojekyll` ist gesetzt). Lokal testen:

```sh
python3 -m http.server 8000   # dann http://localhost:8000
npm test                      # Tests (Node ≥ 20)
```

## PWA / Offline

`sw.js` legt beim ersten Besuch die App-Dateien und die Wörterbücher für Deutsch und Englisch in den Cache; weitere Sprachen folgen, sobald sie zum ersten Mal benutzt werden (Netzwerk zuerst und immer neu geprüft, der Cache springt nur offline oder bei sehr langsamer Verbindung ein, damit nie Dateien verschiedener Versionen gemischt werden). Symbole werden beim ersten Anzeigen zwischengespeichert; der Button *Alle Symbole offline laden* holt alle 6551 auf einmal und lädt dabei alle Sprachen. Der App-Cache heißt `bliss-shell-v3` (bei Änderungen an der Dateiliste in `sw.js` hochzählen). Die Symbol-Caches heißen `bliss-symbols-v1`: **wenn sich `symbols/` ändert** (neues BCI-AV), den Namen in `sw.js` und in `js/app.js` (`SYMBOL_CACHE`) hochzählen. Der Service Worker läuft nur über HTTPS (GitHub Pages) oder `localhost`.

## GoatCounter einrichten

1. Konto auf goatcounter.com anlegen und eine Site anlegen, z. B. `bliss-translator` (erreichbar unter `https://bliss-translator.goatcounter.com`).
2. In `js/config.js` den Site-Code eintragen: `export const GOATCOUNTER = "bliss-translator";`
3. Committen und pushen. Solange der Code leer ist, wird nichts geladen und nichts gezählt.

Gezählt werden Seitenaufrufe sowie die Ereignisse *export-png*, *print*, *share-link*, *copy-link* und *choose-alternative*. Der eingegebene Text wird **nicht** übertragen. Ein Hinweis im Seitenfuß erscheint automatisch, sobald GoatCounter aktiv ist.

## Vokabular neu erzeugen

Die Daten stammen von <https://blissymbolics.org> (Seite *BCI-AV*). Benötigt werden die Tabelle als CSV und `bliss_svg_id.zip`:

```sh
pip install lxml numpy pillow    # außerdem: rsvg-convert (librsvg)
python3 tools/build.py source/BCI-AV.csv --svg-zip source/bliss_svg_id.zip   # alles neu
python3 tools/build.py source/BCI-AV.csv --reuse-metrics                      # nur Wortlisten, Symbole und Metriken bleiben
```

Das Skript bereinigt die SVGs (Klassen werden zu Attributen, Zuschnitt, gemeinsame Grundlinie), ermittelt je Symbol Mitte und Oberkante des ersten Zeichens und baut den Wortindex. Veraltete Symbole (`OLD`, `SUPERSEDED`) werden nachrangig einsortiert, Indikatoren und Einzelbuchstaben nicht über Wörter gefunden.

## Grenzen

Die Zuordnung erfolgt **wortweise**. Das ist eine Lesehilfe und keine vollständige Übersetzung in die Bliss-Grammatik (Satzstellung, Passiv, Konjunktiv, Fälle usw. fehlen). Die Lemmatisierung ist regelbasiert und macht Fehler; über den Klick auf das Symbol lässt sich die Bedeutung korrigieren, und `data/overrides.json` nimmt weitere Standardwerte auf. Besonders bei Französisch, Spanisch, Italienisch und Portugiesisch gibt es für seltene unregelmäßige Formen noch Lücken; was nicht erkannt wird, bleibt als Text stehen. Ideen für später: Wörterbuch-Lemmatisierung, weitere Indikatoren (Passiv, Konjunktiv, Adjektiv/Adverb), weitere Sprachen (die BCI-AV-Tabelle enthält 19, z. B. Niederländisch, Schwedisch, Norwegisch), Satzstellung. Ein neues Sprachmodul anzulegen genügt: `js/langs/<code>.js`, in `js/langs/index.js` eintragen und in `tools/build.py` (`LANGS`) die Spalte angeben.

## Lizenz

- **Programmcode** (`js/`, `css/`, `tools/`, `tests/`, `index.html`, `data/overrides.json`): MIT, siehe [LICENSE](LICENSE).
- **Blissymbole und Vokabular** (`symbols/`, `data/symbols.json`, `data/lang/`): © Blissymbolics Communication International (BCI), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Weitergabe nur mit Namensnennung und unter derselben Lizenz, siehe [LICENSE-DATA.md](LICENSE-DATA.md). Das exportierte PNG trägt eine kleine Quellenzeile unter den Symbolen.

Dies ist kein offizielles Produkt von BCI.
