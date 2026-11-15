// Text -> Bliss symbol tokens. Pure logic, no DOM and no network, so it can be tested in Node.
// Language specific rules live in js/langs/*.js (see js/langs/index.js for the plug-in shape).
import { LANGS, CODES } from "./langs/index.js";

// BCI-AV ids of the grammar indicators and punctuation marks.
export const IND = { plural: "9011", past: "9004", future: "8999" };
const PUNCT_IDS = { ".": "8486", ",": "8487", "?": "8485", "!": "8483" };

/** Field positions in a symbol record of data/symbols.json. */
export const F = { LABEL: 0, POS: 1, DEP: 2, W: 3, TOP: 4, BOTTOM: 5, CX: 6, FTOP: 7 };

const TOKEN_RE = /\p{L}+(?:[-'’]\p{L}+)*|\d+|\n|[^\s]/gu;
const isWord = (t) => /^\p{L}/u.test(t);
const SKIP_CHARS = /^[¿¡"“”„«»‹›‘’'`]$/u; // quotation marks: no Bliss symbol, silently skipped
const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export class Translator {
  /**
   * @param symbols parsed data/symbols.json
   * @param overrides parsed data/overrides.json ({ <lang>: { word: id } })
   */
  constructor(symbols, overrides = {}) {
    this.S = symbols.s;
    this.bases = symbols.ab || {};
    this.overlayVerbs = new Set(symbols.ov || []);
    this.overrides = overrides;
    this.terms = {}; // lang -> { word: [ids] }
    this.labels = {}; // lang -> { id: label }
    this.folded = {}; // lang -> lazily built accent-insensitive index
  }

  has(lang) {
    return !!this.terms[lang];
  }

  /** Register the word index of one language (data/lang/<code>.json). */
  addLanguage(lang, data) {
    this.terms[lang] = data.t;
    this.labels[lang] = data.l;
    // hand-picked defaults for very common ambiguous words go first
    for (const [term, id] of Object.entries(this.overrides[lang] || {})) {
      if (!this.S[id]) continue;
      data.t[term] = [id, ...(data.t[term] || []).filter((x) => x !== id)];
    }
  }

  lookup(lang, term) {
    return this.terms[lang]?.[term] || null;
  }

  /** Accent-insensitive fallback ("eleve" -> "élève"), only used when nothing else matched. */
  lookupFolded(lang, term) {
    if (!LANGS[lang].foldFallback) return null;
    if (!this.folded[lang]) {
      const m = (this.folded[lang] = new Map());
      for (const [t, ids] of Object.entries(this.terms[lang])) {
        const k = fold(t);
        if (k !== t && !m.has(k)) m.set(k, ids);
      }
    }
    return this.folded[lang].get(fold(term)) || null;
  }

  /** Display label of a symbol in a language (falls back to English). */
  label(id, lang) {
    const raw = this.labels[lang]?.[id] ?? this.S[id][F.LABEL];
    return raw.replace(/-\(([^)]*)\)/g, " ($1)");
  }

  /** Guess the language of a text from stop words and characteristic letters. */
  detectLang(text, fallback = "de") {
    const words = (text.toLowerCase().match(/\p{L}+/gu) || []).slice(0, 80);
    const loaded = CODES.filter((c) => this.terms[c]);
    const score = Object.fromEntries(CODES.map((c) => [c, 0]));
    for (const w of words) {
      for (const c of CODES) {
        const L = LANGS[c];
        if (L.markers.has(w)) score[c] += 2;
        if (L.chars && L.chars.test(w)) score[c] += 3;
        // a word known to exactly one of the loaded languages is a weak hint
        if (this.terms[c]?.[w] && loaded.every((o) => o === c || !this.terms[o][w])) score[c] += 1;
      }
    }
    const best = Math.max(...Object.values(score));
    if (best === 0) return fallback;
    const winners = CODES.filter((c) => score[c] === best);
    return winners.includes(fallback) ? fallback : winners[0];
  }

  /** Re-rank symbol ids so that ones matching the expected part of speech come first. */
  prefer(ids, hint) {
    if (!hint) return ids;
    const want = hint === "n" ? ["n", "p"] : [hint];
    const good = ids.filter((i) => want.includes(this.S[i][F.POS]));
    return good.length ? [...good, ...ids.filter((i) => !good.includes(i))] : ids;
  }

  /**
   * Look a single word up: irregular forms, the exact word, lemma rules, accent-insensitive.
   * hint ("n" | "v") is the part of speech the context suggests.
   */
  resolveWord(surface, lang, { sentenceStart = false, hint = null } = {}) {
    const L = LANGS[lang];
    const lw = surface.toLowerCase().replace(/’/g, "'");
    let cands = L.lemmas(surface, { sentenceStart });
    const capital = L.capitalNoun && !sentenceStart && surface[0] !== lw[0];
    const hit = (lemma, feat) => {
      const ids = this.lookup(lang, lemma);
      if (!ids) return null;
      const h = feat.pos || (capital && lemma === lw ? "n" : null) || hint;
      return { lemma, feat, ids: this.prefer(ids, h) };
    };
    let r;
    // irregular forms win, except right after an article ("l'été", "the saw")
    if (cands[0]?.feat.irreg && hint !== "n") {
      if ((r = hit(cands[0].lemma, cands[0].feat))) return r;
      // auxiliaries without a Bliss symbol (Spanish "haber") are kept so that the grammar can use them
      if (L.aux?.has(cands[0].lemma)) return { lemma: cands[0].lemma, feat: cands[0].feat, ids: [], aux: true };
    }
    const variants = L.variants ? L.variants(lw) : [lw];
    for (const v of variants) if ((r = hit(v, {}))) return r;
    if (hint && !cands[0]?.feat.irreg) cands = [...cands.filter((c) => c.feat.pos === hint), ...cands.filter((c) => c.feat.pos !== hint)];
    // Rule-derived candidates: first those whose expected part of speech really exists
    // for that lemma (e.g. "Kinder" -> noun "Kind"), then any lemma that exists.
    const fits = (x, feat) => !feat.pos || x.ids.some((i) => (feat.pos === "n" ? "np" : feat.pos).includes(this.S[i][F.POS]));
    const found = cands.map((c) => hit(c.lemma, c.feat));
    // strict languages: a verb ending that leads to a non-verb (French "content" -> "contre") is a false match
    r = found.find((x, i) => x && fits(x, cands[i].feat)) || (L.strict ? null : found.find(Boolean));
    if (r) return r;
    for (const v of variants) {
      const ids = this.lookupFolded(lang, v);
      if (ids) return { lemma: v, feat: {}, ids: this.prefer(ids, hint) };
    }
    return null;
  }

  /**
   * Translate text into a flat token list.
   * Token kinds: sym | cmp (compound) | unk | punct | num | br
   */
  translate(text, { lang = "auto", skipArticles = true, grammar = true, choices = {} } = {}) {
    if (lang === "auto") lang = this.detectLang(text);
    const L = LANGS[lang];
    const raw = this.expandWords(text.match(TOKEN_RE) || [], lang);
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
        if (SKIP_CHARS.test(t)) continue;
        if (PUNCT_IDS[t]) toks.push({ kind: "punct", surface: t, ids: [PUNCT_IDS[t]], sel: 0 });
        else if (t === ";" || t === ":") toks.push({ kind: "punct", surface: t, ids: this.punctIds(t), sel: 0 });
        else toks.push({ kind: "unk", surface: t, symbol: true });
        sentenceStart = /[.!?]/.test(t);
        continue;
      }

      // multi-word expressions ("guten Tag", "thank you", "bonjour à tous")
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
        const ids = [...phrase.ids].sort((a, b) => /\(hello\)/.test(this.S[b][F.LABEL]) - /\(hello\)/.test(this.S[a][F.LABEL]));
        toks.push({ kind: "sym", surface: phrase.surface, lemma: phrase.key, ids, sel: 0, feat: {} });
        i += phrase.n - 1;
        sentenceStart = false;
        continue;
      }

      const lw = t.toLowerCase();
      if (L.particles?.has(lw)) {
        sentenceStart = false;
        continue;
      }
      if (L.articles.has(lw)) {
        sentenceStart = false;
        afterArticle = true;
        if (skipArticles) continue;
      }

      // the word before (for verb cues) and the part of speech the context suggests
      const prev = [...toks].reverse().find((x) => x.kind !== "br");
      const before = prev && prev.kind === "sym" ? prev.surface.toLowerCase() : "";
      const hint = afterArticle ? "n" : L.contextHint ? L.contextHint(t, before) : L.verbCues?.has(before) ? "v" : null;

      let r = this.resolveWord(t, lang, { sentenceStart, hint });
      if (r?.aux) {
        toks.push({ kind: "aux", surface: t, lemma: r.lemma, ids: [], sel: 0, feat: r.feat });
      } else if (r) {
        toks.push({ kind: "sym", surface: t, lemma: r.lemma, ids: r.ids, sel: 0, feat: r.feat });
      } else if (L.compound && t.length >= 7 && (r = L.compound(t, (w) => this.resolveWord(w, lang)))) {
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
    if (grammar) this.applyGrammar(toks, lang);
    // an auxiliary that no rule consumed is shown as plain text
    for (const t of toks) if (t.kind === "aux" && !t.drop) t.kind = "unk";
    return { lang, tokens: toks.filter((t) => !t.drop) };
  }

  /** Split contractions and clitics ("j'ai" -> je ai, "don't" -> do not, "del" -> de el). */
  expandWords(raw, lang) {
    const L = LANGS[lang];
    if (!L.expand) return raw;
    const known = (w) => !!this.terms[lang]?.[w];
    const out = [];
    for (const t of raw) {
      const parts = isWord(t) ? L.expand(t, known) : null;
      if (parts) out.push(...parts);
      else out.push(t);
    }
    return out;
  }

  digitId(lang, d) {
    const ids = this.lookup(lang, d) || this.lookup("en", d) || this.lookup("de", d) || [];
    return ids.find((i) => /\(digit\)$/.test(this.S[i][F.LABEL]));
  }

  punctIds(ch) {
    const names = { ";": ["semicolon"], ":": ["colon"] }[ch] || [];
    for (const n of names) if (this.lookup("en", n)) return this.lookup("en", n);
    return [];
  }

  posOf(tok) {
    return tok.kind === "sym" ? this.S[tok.ids[tok.sel]][F.POS] : null;
  }

  /** Auxiliaries and particles become tense indicators on the main verb. */
  applyGrammar(toks, lang) {
    const L = LANGS[lang];
    const isEnd = (t) => t.kind === "punct" || t.kind === "br";
    const g = {
      /** index of the first live word token after i (within max tokens, same clause) matching pred, else -1 */
      forward: (i, pred, max = 6) => {
        for (let j = i + 1; j < toks.length && j <= i + max; j++) {
          if (isEnd(toks[j]) && toks[j].surface !== ",") return -1;
          if (toks[j].kind === "sym" && !toks[j].drop && pred(toks[j])) return j;
        }
        return -1;
      },
      isVerb: (t) => this.posOf(t) === "v",
      isInf: (t) => g.isVerb(t) && (L.isInfinitive ? L.isInfinitive(t) : t.surface.toLowerCase() === t.lemma),
      hasPart: (t) => g.isVerb(t) && (t.feat.part || t.feat.partAmb || (L.pastIsParticiple && t.feat.past)),
      setTense: (aux, main, tense) => {
        toks[main].tense = tense;
        aux.drop = true;
      },
    };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if ((t.kind === "sym" || t.kind === "aux") && !t.drop) L.grammar?.(toks, i, g);
    }
    for (const t of toks) {
      if (t.kind !== "sym" || t.drop) continue;
      if (!t.tense && (t.feat.past || t.feat.part)) t.tense = "past";
      if (!t.tense && t.feat.fut) t.tense = "future";
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
    const pos = this.S[id][F.POS];
    const out = { main: id, ind: null, badge: null };
    if (tok.plural && (pos === "n" || pos === "p")) out.ind = "plural";
    else if (tok.tense && pos === "v") {
      const base = this.bases[id];
      if (base) {
        out.main = base;
        out.ind = tok.tense;
      } else if (this.overlayVerbs.has(id)) out.ind = tok.tense;
      else out.badge = tok.tense;
    }
    return out;
  }
}
