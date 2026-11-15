// Text -> Bliss symbol tokens. Pure logic, no DOM, so it can be tested in Node.
import { lemmasDe, lemmasEn, deVariants, compoundSplitsDe } from "./lemma.js";

// BCI-AV ids of the grammar indicators and punctuation marks.
export const IND = { plural: "9011", past: "9004", future: "8999" };
const PUNCT_IDS = { ".": "8486", ",": "8487", "?": "8485", "!": "8483" };

const ARTICLES = {
  de: new Set(["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]),
  en: new Set(["the", "a", "an"]),
};
const MARKERS = {
  de: new Set("der die das und ist ich nicht mit ein eine zu den dem von sie wir auch auf für war sind habe hat wird aber oder wie was wo wer ihr du er es im am zum zur dass weil wenn nur noch schon sehr mein dein".split(" ")),
  en: new Set("the and is are i you not with of to in it that for was were have has will but or how what where who he she we they my your this these those at on from by an a do does did".split(" ")),
};
const TOKEN_RE = /\p{L}+(?:[-'’]\p{L}+)*|\d+|\n|[^\s]/gu;
const isWord = (t) => /^\p{L}/u.test(t);

export function labelFor(sym, lang) {
  const l = lang === "de" ? sym[1] : sym[0];
  return l.replace(/-\(([^)]*)\)/g, " ($1)");
}

export class Translator {
  /** @param lex parsed data/lexicon.json */
  constructor(lex, overrides = {}) {
    this.lex = lex;
    this.S = lex.s;
    this.overlayVerbs = new Set(lex.ov || []);
    // hand-picked defaults for very common ambiguous words go first
    for (const lang of ["de", "en"]) {
      for (const [term, id] of Object.entries(overrides[lang] || {})) {
        if (!this.S[id]) continue;
        const rest = (lex[lang][term] || []).filter((x) => x !== id);
        lex[lang][term] = [id, ...rest];
      }
    }
  }

  lookup(lang, term) {
    return this.lex[lang][term] || null;
  }

  detectLang(text, fallback = "de") {
    const words = (text.toLowerCase().match(/\p{L}+/gu) || []).slice(0, 80);
    let de = 0;
    let en = 0;
    for (const w of words) {
      if (MARKERS.de.has(w)) de += 2;
      if (MARKERS.en.has(w)) en += 2;
      if (/[äöüß]/.test(w)) de += 3;
      const inDe = this.lex.de[w];
      const inEn = this.lex.en[w];
      if (inDe && !inEn) de += 1;
      if (inEn && !inDe) en += 1;
    }
    if (de === en) return fallback;
    return de > en ? "de" : "en";
  }

  /** Re-rank symbol ids so that ones matching the expected part of speech come first. */
  prefer(ids, hint) {
    if (!hint) return ids;
    const want = hint === "n" ? ["n", "p"] : [hint];
    const good = ids.filter((i) => want.includes(this.S[i][2]));
    return good.length ? [...good, ...ids.filter((i) => !good.includes(i))] : ids;
  }

  /** Look a single word up, trying irregular forms, the exact word, then lemma rules. */
  resolveWord(surface, lang, { sentenceStart = false } = {}) {
    const lw = surface.toLowerCase();
    const cands = lang === "de" ? lemmasDe(surface, { sentenceStart }) : lemmasEn(surface);
    const capital = lang === "de" && !sentenceStart && surface[0] !== lw[0];
    const hit = (lemma, feat) => {
      const ids = this.lookup(lang, lemma);
      if (!ids) return null;
      const hint = feat.pos || (capital && lemma === lw ? "n" : null);
      return { lemma, feat, ids: this.prefer(ids, hint) };
    };
    let r;
    if (cands[0]?.feat.irreg && (r = hit(cands[0].lemma, cands[0].feat))) return r;
    for (const v of lang === "de" ? deVariants(lw) : [lw]) if ((r = hit(v, {}))) return r;
    // Rule-derived candidates: first those whose expected part of speech really exists
    // for that lemma (e.g. "Kinder" -> noun "Kind"), then any lemma that exists.
    const fits = (x, feat) => !feat.pos || x.ids.some((i) => (feat.pos === "n" ? "np" : feat.pos).includes(this.S[i][2]));
    const found = cands.map((c) => hit(c.lemma, c.feat));
    return found.find((x, i) => x && fits(x, cands[i].feat)) || found.find(Boolean) || null;
  }

  /**
   * Translate text into a flat token list.
   * Token kinds: sym | cmp (compound) | unk | punct | num | br
   */
  translate(text, { lang = "auto", skipArticles = true, grammar = true, choices = {} } = {}) {
    if (lang === "auto") lang = this.detectLang(text);
    const raw = text.match(TOKEN_RE) || [];
    const toks = [];
    let sentenceStart = true;
    let afterArticle = false;

    for (let i = 0; i < raw.length; i++) {
      const t = raw[i];
      if (t === "\n") {
        toks.push({ kind: "br" });
        sentenceStart = true;
        continue;
      }
      if (/^\d+$/.test(t)) {
        const ids = [...t].map((d) => this.digitId(lang, d));
        toks.push(ids.every(Boolean) ? { kind: "num", surface: t, ids } : { kind: "unk", surface: t });
        sentenceStart = false;
        continue;
      }
      if (!isWord(t)) {
        if (PUNCT_IDS[t]) toks.push({ kind: "punct", surface: t, ids: [PUNCT_IDS[t]], sel: 0 });
        else if (t === ";" || t === ":") toks.push({ kind: "punct", surface: t, ids: this.punctIds(t), sel: 0 });
        else toks.push({ kind: "unk", surface: t, symbol: true });
        sentenceStart = /[.!?]/.test(t);
        continue;
      }

      // multi-word expressions ("guten Tag", "thank you")
      let phrase = null;
      for (let n = 3; n >= 2 && !phrase; n--) {
        const parts = raw.slice(i, i + n);
        if (parts.length === n && parts.every(isWord)) {
          const key = parts.join(" ").toLowerCase();
          const ids = this.lookup(lang, key);
          if (ids) phrase = { n, key, ids, surface: parts.join(" ") };
        }
      }
      if (phrase) {
        // greetings exist as "(hello)" and "(bye)" variants: default to the greeting
        const ids = [...phrase.ids].sort((a, b) => /\(hello\)/.test(this.S[b][0]) - /\(hello\)/.test(this.S[a][0]));
        toks.push({ kind: "sym", surface: phrase.surface, lemma: phrase.key, ids, sel: 0, feat: {} });
        i += phrase.n - 1;
        sentenceStart = false;
        continue;
      }

      const lw = t.toLowerCase();
      if (ARTICLES[lang].has(lw)) {
        sentenceStart = false;
        afterArticle = true;
        if (skipArticles) continue;
      }

      let r = this.resolveWord(t, lang, { sentenceStart });
      if (!r && lang === "en" && /['’]/.test(t)) {
        const base = t.split(/['’]/)[0];
        const neg = /n['’]t$/i.test(t);
        const b = neg ? base.replace(/n$/i, "") : base;
        r = this.resolveWord(b || base, lang, { sentenceStart });
        if (r && neg) {
          const nt = this.lookup("en", "not");
          toks.push({ kind: "sym", surface: t, lemma: r.lemma, ids: r.ids, sel: 0, feat: r.feat });
          toks.push({ kind: "sym", surface: "n't", lemma: "not", ids: nt, sel: 0, feat: {} });
          sentenceStart = false;
          continue;
        }
      }
      if (r) {
        toks.push({ kind: "sym", surface: t, lemma: r.lemma, ids: this.contextRank(r, t, lang, toks, afterArticle), sel: 0, feat: r.feat });
      } else if (lang === "de" && t.length >= 7 && (r = compoundSplitsDe(t, (w) => this.resolveWord(w, "de")))) {
        // Bliss compounds start with the classifier (= German head, the last part)
        const mk = (surface, x) => ({ kind: "sym", surface, lemma: x.lemma, ids: x.ids, sel: 0, feat: {} });
        toks.push({ kind: "cmp", surface: t, parts: [mk(r.headWord, r.head), mk(r.modWord, r.modifier)] });
      } else {
        toks.push({ kind: "unk", surface: t });
      }
      sentenceStart = false;
      afterArticle = false;
    }

    // user-chosen meanings (by lower-case word)
    for (const t of toks) {
      const c = t.kind === "sym" ? choices[t.surface.toLowerCase()] : null;
      if (c && t.ids.includes(c)) t.sel = t.ids.indexOf(c);
    }
    if (grammar) this.applyGrammar(toks, lang, skipArticles);
    return { lang, tokens: toks.filter((t) => !t.drop) };
  }

  /** Use the neighbourhood of a word to choose between noun and verb readings. */
  contextRank(r, surface, lang, toks, afterArticle) {
    if (r.feat.pos) return r.ids; // the lemmatizer already knows the part of speech
    const prev = [...toks].reverse().find((t) => t.kind !== "br");
    if (afterArticle) return this.prefer(r.ids, "n");
    if (lang === "en") {
      const before = prev && prev.kind === "sym" ? prev.surface.toLowerCase() : "";
      const VERB_CUES = ["to", "will", "shall", "can", "could", "would", "should", "must", "may", "might", "i", "you", "we", "they", "he", "she", "it", "do", "does", "did", "not", "n't"];
      if (VERB_CUES.includes(before)) return this.prefer(r.ids, "v");
    } else if (/(en|ln|rn)$/.test(surface) && surface === surface.toLowerCase()) {
      return this.prefer(r.ids, "v"); // lower-case infinitive-looking word: verb reading first
    }
    return r.ids;
  }

  digitId(lang, d) {
    const ids = this.lookup(lang, d) || this.lookup("en", d) || [];
    return ids.find((i) => /\(digit\)$/.test(this.S[i][0]));
  }

  punctIds(ch) {
    const names = { ";": ["semicolon"], ":": ["colon"] }[ch] || [];
    for (const n of names) if (this.lookup("en", n)) return this.lookup("en", n);
    return [];
  }

  posOf(tok) {
    return tok.kind === "sym" ? this.S[tok.ids[tok.sel]][2] : null;
  }

  /** Aux verbs and particles become tense indicators on the main verb. */
  applyGrammar(toks, lang) {
    const isEnd = (t) => t.kind === "punct" || t.kind === "br";
    const forward = (i, pred, max = 6) => {
      for (let j = i + 1; j < toks.length && j <= i + max; j++) {
        if (isEnd(toks[j]) && toks[j].surface !== ",") return -1;
        if (toks[j].kind === "sym" && !toks[j].drop && pred(toks[j])) return j;
      }
      return -1;
    };
    const isVerb = (t) => this.posOf(t) === "v";
    const isInf = (t) => isVerb(t) && (lang === "de" ? t.surface.toLowerCase() === t.lemma : !t.feat.past && !t.feat.part);
    const hasPart = (t) => isVerb(t) && (t.feat.part || (lang === "en" && t.feat.past));

    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.kind !== "sym" || t.drop) continue;
      const L = t.lemma;
      const lw = t.surface.toLowerCase();
      if (lang === "de") {
        if (L === "werden" && !t.feat.past) {
          const j = forward(i, isInf);
          if (j >= 0) {
            toks[j].tense = "future";
            t.drop = true;
          }
        } else if (L === "haben" || L === "sein") {
          const j = forward(i, (x) => hasPart(x));
          if (j >= 0) {
            toks[j].tense = "past";
            t.drop = true;
          }
        } else if (lw === "zu") {
          const j = forward(i, isInf, 1);
          if (j === i + 1) t.drop = true;
        }
      } else {
        if (lw === "will" || lw === "shall") {
          const j = forward(i, isInf, 3);
          if (j >= 0) {
            toks[j].tense = "future";
            t.drop = true;
          }
        } else if (L === "have" && lw !== "have") {
          const j = forward(i, hasPart, 3);
          if (j >= 0) {
            toks[j].tense = "past";
            t.drop = true;
          }
        } else if (lw === "did") {
          const j = forward(i, isInf, 3);
          if (j >= 0) {
            toks[j].tense = "past";
            t.drop = true;
          }
        } else if (lw === "to") {
          const j = forward(i, isInf, 1);
          if (j === i + 1) t.drop = true;
        }
      }
    }
    for (const t of toks) {
      if (t.kind !== "sym" || t.drop) continue;
      if (!t.tense && (t.feat.past || t.feat.part)) t.tense = "past";
      if (t.feat.pl) t.plural = true;
    }
  }

  /**
   * What to draw for a token: the main symbol id (the unmarked base for verbs, so that its
   * action indicator can be replaced by a tense indicator), an optional indicator and an
   * optional text badge when no indicator can be drawn.
   */
  view(tok) {
    const id = tok.ids[tok.sel];
    const sym = this.S[id];
    const out = { main: id, ind: null, badge: null };
    if (tok.plural && (sym[2] === "n" || sym[2] === "p")) out.ind = "plural";
    else if (tok.tense && sym[2] === "v") {
      const base = this.lex.ab[id];
      if (base) {
        out.main = base;
        out.ind = tok.tense;
      } else if (this.overlayVerbs.has(id)) out.ind = tok.tense;
      else out.badge = tok.tense;
    }
    return out;
  }
}
