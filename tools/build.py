#!/usr/bin/env python3
"""Build the web assets from the BCI-AV release files.

Usage:
    python3 tools/build.py BCI-AV.csv --svg-zip bliss_svg_id.zip [--out DIR]
    python3 tools/build.py BCI-AV.csv --reuse-metrics            # words only, keep symbols/

Inputs (both from https://blissymbolics.org, BCI-AV release):
  * the spreadsheet exported as CSV (columns: BCI-AV#, English, POS, German, ...)
  * bliss_svg_id.zip (one SVG per symbol, named <BCI-AV#>.svg)

Outputs (relative to --out, default = repository root):
  * symbols/<id>.svg      cleaned, horizontally cropped, theme-neutral SVGs
  * data/symbols.json     language independent symbol table (metrics, part of speech, verb bases)
  * data/lang/<code>.json one file per input language: word -> symbol ids and display labels

Add a language by adding it to LANGS below (CSV column name) and a plug-in in js/langs/.

Requires: python3, lxml, numpy, Pillow and the `rsvg-convert` binary.
The BCI-AV data is (c) Blissymbolics Communication International, CC BY-SA 4.0.
"""
import argparse
import csv
import io
import json
import re
import subprocess
import sys
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from lxml import etree
from PIL import Image

csv.field_size_limit(10 ** 8)
SVG_NS = "http://www.w3.org/2000/svg"
NUM = re.compile(r"-?\d+\.\d+")


def rnd(match):
    v = round(float(match.group(0)), 1)
    return str(int(v)) if v == int(v) else str(v)


def parse_classes(style_text):
    out = {}
    for name, body in re.findall(r"\.(\w+)\s*\{([^}]*)\}", style_text or ""):
        out[name] = dict(
            (k.strip(), v.strip()) for k, v in (p.split(":", 1) for p in body.split(";") if ":" in p)
        )
    return out


def clean_svg(raw):
    """Return (svg_body_elements, units, stroke_width, canvas_w, canvas_h).

    All class based styling is resolved to presentation attributes so that many
    SVGs can be inlined into one page without CSS collisions."""
    root = etree.fromstring(raw, etree.XMLParser(load_dtd=False, no_network=True))
    vb = [float(x) for x in root.get("viewBox").split()]
    classes = parse_classes(" ".join(s.text or "" for s in root.iter("{%s}style" % SVG_NS)))
    stroke = 7.0
    parts = []
    for el in root.iter():
        tag = etree.QName(el).localname
        if tag not in ("line", "path", "circle", "ellipse", "text"):
            continue
        cls = el.get("class", "")
        st = {}
        for c in cls.split():
            st.update(classes.get(c, {}))
        attrs = {}
        for k, v in el.attrib.items():
            k = etree.QName(k).localname if k.startswith("{") else k
            if k in ("class", "style", "lang", "space"):
                continue
            attrs[k] = v
        if tag == "text":
            attrs["font-size"] = st.get("font-size", "16px").replace("px", "")
            attrs["font-family"] = "Arial, Helvetica, sans-serif"
            attrs["fill"] = "#000"
            attrs.pop("stroke", None)
            attrs["dominant-baseline"] = "alphabetic"
            body = (el.text or "").replace("&", "&amp;").replace("<", "&lt;")
        else:
            body = None
            sw = st.get("stroke-width")
            if sw and st.get("stroke", "").startswith("rgb(0"):
                attrs["stroke-width"] = sw
                stroke = float(sw)
            elif attrs.get("fill", "none") == "none":
                attrs["stroke-width"] = str(stroke)
            if attrs.get("fill", "").startswith("rgb(0"):
                attrs["fill"] = "#000"
        txt = " ".join('%s="%s"' % (k, NUM.sub(rnd, v)) for k, v in attrs.items())
        parts.append("<%s %s>%s</%s>" % (tag, txt, body, tag) if body is not None else "<%s %s/>" % (tag, txt))
    return parts, stroke, vb[2], vb[3]


def make_svg(parts, vbox):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%s" fill="none" stroke="#000" '
        'stroke-linecap="round" stroke-linejoin="round">%s</svg>' % (vbox, "".join(parts))
    )


def ink_bounds(svg_text, w, h, gap=20.0):
    """Render at 1px per SVG unit and return the ink extents.

    Besides the overall x/y extents this returns the first *character* (first run
    of inked columns, split at gaps >= `gap` px): its x-range and top edge. The
    BCI rules put indicators above the first character of a word."""
    png = subprocess.run(
        ["rsvg-convert", "-f", "png", "-w", str(int(w)), "-h", str(int(h))],
        input=svg_text.encode(), capture_output=True, check=True,
    ).stdout
    a = np.array(Image.open(io.BytesIO(png)).convert("RGBA"))[:, :, 3] > 40
    cols, rows = np.where(a.any(axis=0))[0], np.where(a.any(axis=1))[0]
    if len(cols) == 0:
        return 0, w, 0, h, 0, w, 0
    end = cols[0]
    for c in cols[1:]:
        if c - end > gap:
            break
        end = c
    first = a[:, cols[0]:end + 1]
    ftop = np.where(first.any(axis=1))[0][0]
    return cols[0], cols[-1] + 1, rows[0], rows[-1] + 1, cols[0], end + 1, ftop


# ---------------------------------------------------------------- lexicon

# Common vertical window (grid units, 324 = canvas height at stroke 7):
# body is y=130..258, indicators sit above at ~y=66; symbols that stick out
# further get their own, larger viewBox and are aligned by the browser.
GY0, GY1 = 62, 266
# code -> column name in the BCI-AV spreadsheet
LANGS = {
    "en": "English", "de": "German", "fr": "French", "es": "Spanish",
    "it": "Italian", "pt": "Portugese", "eo": "Esperanto",
}
POS_CODE = {"YELLOW": "n", "RED": "v", "BLUE": "p", "GREEN": "a", "WHITE": "o", "GRAY": "g"}  # g = interjections/indicators
LETTER = re.compile(r"\((lower|upper)case\)")
DEPRECATED = re.compile(r"\((OLD|ALT)\)|SUPERSEDED", re.I)


def split_top(s):
    """Split on commas that are not inside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x.strip() for x in out if x.strip()]


def term_of(gloss, lang):
    g = gloss.replace("\u2019", "'")
    if lang == "en":
        g = g.replace("_", " ")
        g = re.sub(r"-\(to\)", "", g)
    g = re.sub(r"\([^)]*\)", " ", g)  # drop parentheticals: "niño(a)", "chien (animal)"
    g = re.sub(r"/\w{1,3}$", "", g.strip())  # "bambino/a" -> "bambino"
    g = re.sub(r"\s+", " ", g).strip(" -").lower()
    return g


def split_glosses(value):
    out = []
    for part in value.split(";"):
        out.extend(split_top(part))
    return out


def render_symbols(rows, ix, zip_path, out):
    """Clean, crop and write all SVGs; return per-symbol metrics."""
    z = zipfile.ZipFile(zip_path)
    ids = [r[ix["BCI-AV#"]] for r in rows[1:]]

    def pass1(i):
        raw = z.read("bliss_svg_id/%s.svg" % i)
        parts, stroke, cw, ch = clean_svg(raw)
        full = make_svg(parts, "0 0 %s %s" % (cw, ch))
        x0, x1, y0, y1, fx0, fx1, ftop = ink_bounds(full, cw, ch, gap=20.0 * stroke / 7.0)
        f = stroke / 7.0
        return i, parts, stroke, cw, ch, x0, x1, y0 / f, y1 / f, fx0, fx1, ftop / f

    with ThreadPoolExecutor(8) as ex:
        res = list(ex.map(pass1, ids))
    total = 0
    meta = {}
    (out / "symbols").mkdir(parents=True, exist_ok=True)
    for i, parts, stroke, cw, ch, x0, x1, iy0, iy1, fx0, fx1, ftop in res:
        f = stroke / 7.0
        pad = 0.5 * stroke
        vx = max(0, x0 - pad)
        vw = (x1 + pad) - vx
        vy0 = min(GY0, int(iy0) - 2)
        vy1 = max(GY1, int(iy1) + 3)
        svg = make_svg(parts, "%s %s %s %s" % (round(vx, 1), round(vy0 * f, 1), round(vw, 1), round((vy1 - vy0) * f, 1)))
        (out / "symbols" / ("%s.svg" % i)).write_text(svg)
        total += len(svg)
        # width, top, bottom, first-character centre-x and first-character top (grid units)
        meta[i] = [round(vw / f, 1), vy0, vy1, round(((fx0 + fx1) / 2 - vx) / f, 1), round(ftop, 1)]
    print("symbols written: %d, %.1f MB" % (len(res), total / 1e6))
    return meta


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--svg-zip", help="bliss_svg_id.zip (renders symbols/ and measures them)")
    ap.add_argument("--reuse-metrics", action="store_true", help="reuse the metrics in data/symbols.json, do not touch symbols/")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent))
    a = ap.parse_args()
    out = Path(a.out)
    (out / "data" / "lang").mkdir(parents=True, exist_ok=True)

    rows = list(csv.reader(open(a.csv, encoding="utf-8")))
    head = rows[0]
    ix = {n: head.index(n) for n in ("BCI-AV#", "English", "POS", "Derivation - explanation")}
    col = {code: head.index(name) for code, name in LANGS.items()}
    get = lambda r, i: r[i] if len(r) > i else ""

    if a.reuse_metrics:
        old = json.loads((out / "data" / "symbols.json").read_text())
        meta = {sid: v[3:] for sid, v in old["s"].items()}
    else:
        meta = render_symbols(rows, ix, a.svg_zip, out)

    # ---- symbol table
    symbols = {}
    glosses = {}  # lang -> sid -> [gloss]
    for code in LANGS:
        glosses[code] = {}
    for r in rows[1:]:
        sid = r[ix["BCI-AV#"]]
        en = r[ix["English"]]
        pos = POS_CODE.get(r[ix["POS"]], "o")
        dep = 1 if (DEPRECATED.search(en) or DEPRECATED.search(get(r, col["de"])) or DEPRECATED.search(r[ix["Derivation - explanation"]])) else 0
        en_glosses = split_glosses(en)
        label_en = en_glosses[0].replace("_", " ") if en_glosses else ""
        symbols[sid] = [label_en, pos, dep] + meta[sid]  # [label, pos, deprecated, w, y0, y1, cx, ftop]
        for code in LANGS:
            glosses[code][sid] = split_glosses(get(r, col[code]))

    def rank(entries):
        # non-deprecated first, then primary gloss, then fewer synonyms, then lower id
        entries.sort(key=lambda e: (symbols[e[0]][2], min(e[1], 1), e[2], int(e[0])))
        return [e[0] for e in entries]

    # ---- per-language word indexes
    indexes = {}
    for code in LANGS:
        idx = {}
        for r in rows[1:]:
            sid = r[ix["BCI-AV#"]]
            en = r[ix["English"]]
            if en.startswith("indicator") or LETTER.search(en):
                continue  # grammar indicators and single letters are never looked up by word
            gl = glosses[code][sid]
            seen = set()
            for k, g in enumerate(gl):
                t = term_of(g, code)
                if not t or t in seen:
                    continue
                seen.add(t)
                idx.setdefault(t, []).append((sid, k, len(gl)))
        indexes[code] = idx

    # Verb symbols are "<base> + action indicator". To show tense we must swap
    # that indicator, so remember the unmarked base symbol where it is a single gloss.
    ACTION = re.compile(r"^\((.+?) \+ action indicator\s*(?:[:)]|$)")
    deriv = {r[ix["BCI-AV#"]]: r[ix["Derivation - explanation"]] for r in rows[1:]}
    bases = {}
    for sid, sym in symbols.items():
        if sym[1] != "v":
            continue
        m = ACTION.match(deriv[sid].strip())
        if not m or "+" in m.group(1):
            continue
        cands = [c for c in indexes["en"].get(term_of(m.group(1), "en"), []) if symbols[c[0]][1] not in ("v", "g")]
        if cands:
            bases[sid] = rank(cands)[0]
    # verbs that are plain characters (no action indicator in their derivation): a tense
    # indicator can simply be placed above them
    overlay = [
        sid for sid, sym in symbols.items()
        if sym[1] == "v" and sid not in bases and "action indicator" not in deriv[sid].lower()
    ]
    print("verbs with swappable action indicator:", len(bases), "| overlay-only verbs:", len(overlay))

    dump = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":"))
    (out / "data" / "symbols.json").write_text(dump({
        "v": 2,
        "win": [GY0, GY1],  # common vertical window of the symbol SVGs (grid units)
        "fields": ["label", "pos", "deprecated", "width", "top", "bottom", "cx", "ftop"],
        "s": symbols,
        "ab": bases,
        "ov": overlay,
    }))
    for code in LANGS:
        terms = {t: rank(e) for t, e in sorted(indexes[code].items())}
        labels = {}
        for sid, gl in glosses[code].items():
            if gl:
                lab = gl[0].replace("_", " ") if code == "en" else gl[0]
                if lab != symbols[sid][0] or code == "en":
                    labels[sid] = lab
        (out / "data" / "lang" / ("%s.json" % code)).write_text(dump({"t": terms, "l": labels}))
        print("%s: %d terms, %d labels" % (code, len(terms), len(labels)))


if __name__ == "__main__":
    main()
