// Esperanto: very regular, so the lemmatizer is just the ending system.
import { collector, words } from "./util.js";

const X = { cx: "ĉ", gx: "ĝ", hx: "ĥ", jx: "ĵ", sx: "ŝ", ux: "ŭ" };
const H = { ch: "ĉ", gh: "ĝ", hh: "ĥ", jh: "ĵ", sh: "ŝ" };

/** x-system ("cxu") and h-system ("chu") spellings of the supercircumflex letters. */
const variants = (w) => {
  const out = new Set([w]);
  if (/[cghjsu]x/.test(w)) out.add(w.replace(/([cghjsu])x/g, (_, c) => X[c + "x"]));
  if (/[cghjs]h/.test(w)) out.add(w.replace(/([cghjs])h/g, (_, c) => H[c + "h"]));
  return [...out];
};

const TENSE = { as: {}, is: { past: true }, os: { fut: true }, us: {}, u: {} };
const PARTICIPLE = /^(.+?)(ant|int|ont|at|it|ot)(a|o|e)(j)?(n)?$/;

function lemmas(word) {
  const w = word.toLowerCase().replace(/’/g, "'");
  const { cands, push } = collector();
  // participles: manĝanta, manĝinta, manĝota ...
  let m = w.match(PARTICIPLE);
  if (m && m[1].length >= 2) {
    const feat = { pos: "v" };
    if (m[2] === "int" || m[2] === "it") feat.part = true;
    push(m[1] + "i", feat);
  }
  // nouns and adjectives: -o -oj -on -ojn / -a -aj -an -ajn
  m = w.match(/^(.+)o(j)?(n)?$/);
  if (m) push(m[1] + "o", m[2] ? { pl: true, pos: "n" } : { pos: "n" });
  m = w.match(/^(.+)a(j)?(n)?$/);
  if (m) push(m[1] + "a", { pos: "a" });
  // adverbs
  if (w.endsWith("e")) push(w.slice(0, -1) + "a", { pos: "a", adv: true });
  // verbs
  m = w.match(/^(.+)(as|is|os|us|u)$/);
  if (m) push(m[1] + "i", { pos: "v", ...TENSE[m[2]] });
  // accusative of pronouns and others: min, vin, tiun, kiun ...
  if (w.endsWith("n") && w.length >= 3) push(w.slice(0, -1), {});
  return cands;
}

export default {
  code: "eo",
  name: "Esperanto",
  strict: true,
  articles: new Set(["la"]),
  markers: new Set(words("la kaj estas mi vi li ŝi ni ili oni ne de en kun por sed aŭ kiel tre mia via lia ŝia nia ilia ĉi tio tiu kiu estis estos ĝi al el pri")),
  chars: /[ĉĝĥĵŝŭ]/,
  lemmas,
  variants,
  verbCues: new Set(words("mi vi li ŝi ĝi ni ili oni ne")),
  grammar(toks, i, g) {
    const t = toks[i];
    // "mi estas manĝinta" = I have eaten
    if (t.lemma === "esti" && t.surface.toLowerCase() !== "esti") {
      const j = g.forward(i, (x) => x.feat.part && /int[aoe]/.test(x.surface.toLowerCase()), 1);
      if (j === i + 1) g.setTense(t, j, "past");
    }
  },
};
