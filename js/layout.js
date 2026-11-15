// Layout of Bliss tokens into lines, in "grid units" (1 matrix square = 128 units,
// stroke width = 7 units). Produces a flat list of drawing items that is rendered
// either as an inline SVG (preview) or as a self-contained SVG/PNG (export).
import { IND, F } from "./translate.js";

const SQUARE = 128;
const STROKE = 7;
const BODY_TOP = 126; // top of a normal glyph (skyline minus half a stroke)
const CAP_FONT = 24;
const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Place one symbol (plus optional indicator) in cell-local coordinates (x from 0). */
function placeSymbol(tr, tok, view) {
  const S = tr.S;
  const base = S[view.main];
  const items = [{ t: "img", id: view.main, x: 0, y: base[F.TOP], w: base[F.W], h: base[F.BOTTOM] - base[F.TOP] }];
  let w = base[F.W];
  let minY = base[F.TOP];
  let maxY = base[F.BOTTOM];
  if (view.ind) {
    const id = IND[view.ind];
    const ind = S[id];
    // Rules 4.3.3/4.3.4: centred above the first character, raised for tall characters.
    const dy = Math.min(0, base[F.FTOP] - BODY_TOP);
    const left = base[F.CX] - ind[F.W] / 2;
    const ox = Math.max(0, -left);
    for (const it of items) it.x += ox;
    items.push({ t: "img", id, x: ox + left, y: ind[F.TOP] + dy, w: ind[F.W], h: ind[F.BOTTOM] - ind[F.TOP] });
    w = Math.max(ox + base[F.W], ox + left + ind[F.W]);
    minY = Math.min(minY, ind[F.TOP] + dy);
  }
  return { items, w, minY, maxY };
}

function seq(parts, gap) {
  const items = [];
  let x = 0;
  let minY = Infinity;
  let maxY = -Infinity;
  parts.forEach((p, i) => {
    if (i) x += gap;
    for (const it of p.items) items.push({ ...it, x: it.x + x });
    x += p.w;
    minY = Math.min(minY, p.minY);
    maxY = Math.max(maxY, p.maxY);
  });
  return { items, w: x, minY, maxY };
}

function buildCell(tr, tok, lang) {
  switch (tok.kind) {
    case "sym": {
      const v = tr.view(tok);
      const c = placeSymbol(tr, tok, v);
      c.caption = tok.surface;
      c.badge = v.badge;
      return c;
    }
    case "cmp": {
      const c = seq(tok.parts.map((p) => placeSymbol(tr, p, tr.view(p))), 32 - STROKE);
      c.caption = tok.surface;
      return c;
    }
    case "num": {
      const c = seq(tok.ids.map((id) => placeSymbol(tr, tok, { main: id })), 16 - STROKE);
      c.caption = tok.surface;
      return c;
    }
    case "punct": {
      if (!tok.ids.length) return buildCell(tr, { kind: "unk", surface: tok.surface }, lang);
      return { ...placeSymbol(tr, tok, { main: tok.ids[0] }), caption: "" };
    }
    default: {
      // no symbol: show the word itself in a dashed frame
      const text = tok.surface;
      const fs = 40;
      const w = Math.max(64, Math.round(text.length * fs * 0.58) + 28);
      return {
        items: [{ t: "unk", x: 0, y: 130, w, h: 128, text, fs }],
        w, minY: 126, maxY: 266, caption: "", unknown: true,
      };
    }
  }
}

export function layout(tr, tokens, { width, captions = true, lang = "de" }) {
  const gapWord = captions ? 40 : SQUARE - STROKE;
  const gapBeforePunct = captions ? 12 : SQUARE / 2 - STROKE;
  const lineGap = captions ? 36 : 60;
  const capH = captions ? CAP_FONT + 26 : 0;
  const capW = (s) => (captions ? Math.round(s.length * CAP_FONT * 0.56) + 8 : 0);

  const out = [];
  let lines = [[]];
  tokens.forEach((tok, index) => {
    if (tok.kind === "br") return lines.push([]);
    const cell = buildCell(tr, tok, lang);
    cell.cw = Math.max(cell.w, capW(cell.caption || "") + (cell.badge ? capW(" ·" + cell.badge) : 0));
    cell.kind = tok.kind;
    cell.index = index;
    cell.tok = tok;
    lines[lines.length - 1].push(cell);
  });

  let y = 0;
  let maxW = 0;
  for (const cells of lines) {
    if (!cells.length) {
      y += SQUARE / 2;
      continue;
    }
    // wrap into visual rows
    const rows = [[]];
    let x = 0;
    for (const c of cells) {
      const row = rows[rows.length - 1];
      const gap = row.length ? (c.kind === "punct" ? gapBeforePunct : gapWord) : 0;
      if (row.length && x + gap + c.cw > width) {
        rows.push([c]);
        c.gap = 0;
        x = c.cw;
      } else {
        c.gap = gap;
        row.push(c);
        x += gap + c.cw;
      }
    }
    for (const row of rows) {
      const minY = Math.min(...row.map((c) => c.minY));
      const maxY = Math.max(...row.map((c) => c.maxY));
      let rx = 0;
      for (const c of row) {
        rx += c.gap;
        const dx = rx + (c.cw - c.w) / 2;
        for (const it of c.items) out.push({ ...it, x: it.x + dx, y: y + (it.y - minY) });
        if (captions && c.caption) {
          out.push({ t: "cap", x: rx + c.cw / 2, y: y + (maxY - minY) + CAP_FONT + 10, text: c.caption, badge: c.badge });
        }
        out.push({ t: "hit", x: rx - 4, y, w: c.cw + 8, h: maxY - minY + capH + 8, index: c.index, unknown: !!c.unknown });
        rx += c.cw;
        maxW = Math.max(maxW, rx);
      }
      y += maxY - minY + capH + lineGap;
    }
  }
  return { items: out, width: Math.max(maxW, 1), height: Math.max(y - lineGap, 1) };
}

const BADGE = { de: { past: "Vergangenheit", future: "Zukunft" }, en: { past: "past", future: "future" } };

/**
 * SVG markup for a layout.
 * @param opts.embed  Map id -> {vb, inner}: draw symbols inline (export); otherwise <image href>.
 */
export function toSvg(lay, { embed = null, pad = 0, background = null, lang = "de", labels = null, className = "" } = {}) {
  const W = lay.width + pad * 2;
  const H = lay.height + pad * 2;
  const parts = [];
  for (const it of lay.items) {
    const x = (it.x + pad).toFixed(1);
    const y = (it.y + pad).toFixed(1);
    if (it.t === "img") {
      if (embed) {
        const e = embed.get(it.id);
        if (e) parts.push(`<svg x="${x}" y="${y}" width="${it.w}" height="${it.h}" viewBox="${e.vb}" preserveAspectRatio="none" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">${e.inner}</svg>`);
      } else {
        parts.push(`<image href="symbols/${it.id}.svg" x="${x}" y="${y}" width="${it.w}" height="${it.h}" preserveAspectRatio="none"/>`);
      }
    } else if (it.t === "unk") {
      parts.push(
        `<rect x="${x}" y="${y}" width="${it.w}" height="${it.h}" rx="10" fill="none" stroke="#9a9488" stroke-width="3" stroke-dasharray="9 7"/>` +
          `<text x="${(it.x + pad + it.w / 2).toFixed(1)}" y="${(it.y + pad + it.h / 2 + it.fs * 0.34).toFixed(1)}" text-anchor="middle" font-family='${FONT}' font-size="${it.fs}" fill="#4b463d">${esc(it.text)}</text>`,
      );
    } else if (it.t === "cap") {
      const badge = it.badge ? `<tspan fill="#8a8478" font-size="${CAP_FONT * 0.8}"> · ${esc(BADGE[lang][it.badge])}</tspan>` : "";
      parts.push(`<text x="${(it.x + pad).toFixed(1)}" y="${y}" text-anchor="middle" font-family='${FONT}' font-size="${CAP_FONT}" fill="#2b2822">${esc(it.text)}${badge}</text>`);
    } else if (it.t === "hit" && !embed) {
      const label = labels ? labels(it.index) : "";
      parts.push(
        `<rect class="hit${it.unknown ? " unk" : ""}" data-i="${it.index}" x="${x}" y="${y}" width="${it.w}" height="${it.h}" rx="12" fill="transparent" tabindex="0" role="button" aria-label="${esc(label)}"><title>${esc(label)}</title></rect>`,
      );
    }
  }
  const bg = background ? `<rect width="${W}" height="${H}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" ${className ? `class="${className}" ` : ""}viewBox="0 0 ${W} ${H}" data-w="${W}" data-h="${H}">${bg}${parts.join("")}</svg>`;
}
