// Helpers shared by the language plug-ins.

/**
 * Parse an irregular verb table into Map(form -> {lemma, feat}).
 * One verb per line: lemma|present|past|participle|future (forms separated by spaces).
 * "past" holds every simple past / imperfect form. A form that is both a past tense and a
 * participle keeps feat.past and gains feat.part; one that is both a present form and a
 * participle (French "fait", "écrit") gets feat.partAmb (counts as participle after an
 * auxiliary, but does not mark the verb as past on its own).
 */
export function irregularTable(text) {
  const map = new Map();
  const list = (s) => (s || "").split(" ").filter(Boolean);
  const add = (form, lemma, feat) => {
    if (!map.has(form)) map.set(form, { lemma, feat: { pos: "v", irreg: true, ...feat } });
  };
  for (const line of text.trim().split("\n")) {
    const [lemma, pres, past, part, fut] = line.split("|");
    for (const f of list(pres)) add(f, lemma, {});
    for (const f of list(past)) add(f, lemma, { past: true });
    for (const f of list(fut)) add(f, lemma, { fut: true });
    for (const f of list(part)) {
      const e = map.get(f);
      if (!e) add(f, lemma, { part: true });
      else if (e.lemma === lemma) {
        if (e.feat.past) e.feat.part = true;
        else if (!e.feat.fut) e.feat.partAmb = true;
      }
    }
  }
  return map;
}

/** Suffix rules: [suffix, [replacement...], feat]. Longer suffixes are tried first. */
export function rules(list) {
  return [...list].sort((a, b) => b[0].length - a[0].length);
}

/** Apply suffix rules to a word: pushes stem+replacement for every matching rule. */
export function applyRules(w, ruleList, push, minStem = 2) {
  for (const [suf, reps, feat] of ruleList) {
    if (!w.endsWith(suf) || w.length - suf.length < minStem) continue;
    const stem = w.slice(0, w.length - suf.length);
    for (const r of reps) push(stem + r, feat || {});
  }
}

/** Expand "ar|er|ir" style endings: ends("ar er", "o as a") -> rules replacing each ending by each infinitive. */
export const words = (s) => s.split(/\s+/).filter(Boolean);

/** Candidate collector with the usual length guard. */
export function collector() {
  const cands = [];
  const seen = new Set();
  const push = (lemma, feat = {}) => {
    if (!lemma || lemma.length < 2) return;
    const key = lemma + JSON.stringify(feat);
    if (seen.has(key)) return;
    seen.add(key);
    cands.push({ lemma, feat });
  };
  return { cands, push };
}
