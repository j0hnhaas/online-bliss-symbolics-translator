// English: lemmatizer, contractions and grammar rules.

// ---------------------------------------------------------------- English

const EN_IRREG_VERBS = `
be|am is are|was were|been
have|has|had|had
do|does|did|done
go|goes|went|gone
eat||ate|eaten
see||saw|seen
come||came|come
take||took|taken
give||gave|given
make||made|made
say||said|said
run||ran|run
write||wrote|written
drink||drank|drunk
sleep||slept|slept
sit||sat|sat
stand||stood|stood
find||found|found
think||thought|thought
bring||brought|brought
buy||bought|bought
know||knew|known
speak||spoke|spoken
get||got|gotten
tell||told|told
feel||felt|felt
leave||left|left
keep||kept|kept
meet||met|met
pay||paid|paid
sell||sold|sold
send||sent|sent
build||built|built
fall||fell|fallen
fly||flew|flown
sing||sang|sung
swim||swam|swum
begin||began|begun
drive||drove|driven
ride||rode|ridden
choose||chose|chosen
wear||wore|worn
win||won|won
lose||lost|lost
hear||heard|heard
understand||understood|understood
teach||taught|taught
catch||caught|caught
read||read|read
put||put|put
set||set|set
cut||cut|cut
hold||held|held
lie||lay|lain
sleep||slept|slept
`;
const enIrregular = new Map();
for (const line of EN_IRREG_VERBS.trim().split("\n")) {
  const [lemma, pres, past, part] = line.split("|");
  for (const f of (pres || "").split(" ").filter(Boolean)) enIrregular.set(f, { lemma, feat: { pos: "v", irreg: true } });
  if (part && !enIrregular.has(part)) enIrregular.set(part, { lemma, feat: { pos: "v", part: true, irreg: true } });
  if (past) enIrregular.set(past, { lemma, feat: { pos: "v", past: true, irreg: true } });
}
const EN_IRREG_OTHER = {
  children: ["child", { pl: true, pos: "n" }], men: ["man", { pl: true, pos: "n" }], women: ["woman", { pl: true, pos: "n" }],
  feet: ["foot", { pl: true, pos: "n" }], teeth: ["tooth", { pl: true, pos: "n" }], mice: ["mouse", { pl: true, pos: "n" }],
  people: ["person", { pl: true, pos: "n" }], geese: ["goose", { pl: true, pos: "n" }], lives: ["life", { pl: true, pos: "n" }],
  better: ["good", { pos: "a" }], best: ["good", { pos: "a" }], worse: ["bad", { pos: "a" }], worst: ["bad", { pos: "a" }],
  more: ["much", { pos: "a" }], most: ["much", { pos: "a" }],
};

export function lemmasEn(word) {
  const w = word.toLowerCase().replace(/’/g, "'");
  const cands = [];
  const push = (lemma, feat = {}) => lemma && lemma.length >= 2 && cands.push({ lemma, feat });
  if (enIrregular.has(w)) {
    const { lemma, feat } = enIrregular.get(w);
    push(lemma, feat);
  }
  if (EN_IRREG_OTHER[w]) push(EN_IRREG_OTHER[w][0], { ...EN_IRREG_OTHER[w][1], irreg: true });
  const undouble = (s) => (/(.)\1$/.test(s) && !/(ss|ll|ff|zz)$/.test(s) ? s.slice(0, -1) : null);

  if (w.endsWith("'s")) push(w.slice(0, -2));
  // plural nouns / 3rd person verbs
  if (w.endsWith("ies")) push(w.slice(0, -3) + "y", { pl: true });
  if (w.endsWith("ves")) {
    push(w.slice(0, -3) + "f", { pl: true });
    push(w.slice(0, -3) + "fe", { pl: true });
  }
  if (w.endsWith("es")) push(w.slice(0, -2), { pl: true });
  if (w.endsWith("s") && !w.endsWith("ss")) push(w.slice(0, -1), { pl: true });
  // past / participle
  if (w.endsWith("ied")) push(w.slice(0, -3) + "y", { pos: "v", past: true, part: true });
  if (w.endsWith("ed")) {
    const b = w.slice(0, -2);
    const f = { pos: "v", past: true, part: true };
    const u = undouble(b);
    if (u) push(u, f);
    push(b, f);
    push(b + "e", f);
  }
  // -ing
  if (w.endsWith("ing") && w.length > 4) {
    const b = w.slice(0, -3);
    const u = undouble(b);
    if (u) push(u, { pos: "v" });
    push(b, { pos: "v" });
    push(b + "e", { pos: "v" });
  }
  // comparatives, adverbs
  if (w.endsWith("ier")) push(w.slice(0, -3) + "y", { pos: "a" });
  if (w.endsWith("iest")) push(w.slice(0, -4) + "y", { pos: "a" });
  if (w.endsWith("er")) {
    const b = w.slice(0, -2);
    const u = undouble(b);
    if (u) push(u, { pos: "a" });
    push(b, { pos: "a" });
    push(b + "e", { pos: "a" });
  }
  if (w.endsWith("est")) {
    const b = w.slice(0, -3);
    const u = undouble(b);
    if (u) push(u, { pos: "a" });
    push(b, { pos: "a" });
    push(b + "e", { pos: "a" });
  }
  if (w.endsWith("ily")) push(w.slice(0, -3) + "y", { pos: "a", adv: true });
  if (w.endsWith("ly")) push(w.slice(0, -2), { pos: "a", adv: true });
  return cands;
}

// ---------------------------------------------------------------- plug-in

const CONTRACTIONS = { "won't": ["will", "not"], "can't": ["can", "not"], "shan't": ["shall", "not"], "ain't": ["be", "not"], "let's": ["let", "us"] };
const CLITIC = { ll: "will", ve: "have", re: "are", m: "am", d: "would" };

export default {
  code: "en",
  name: "English",
  articles: new Set(["the", "a", "an"]),
  markers: new Set("the and is are am i you not with of to in it that for was were have has had will but or how what where who he she we they my your me this these those at on from by an do does did been very".split(" ")),
  lemmas: lemmasEn,
  isInfinitive: (t) => !t.feat.past && !t.feat.part,
  pastIsParticiple: true,
  verbCues: new Set(["to", "will", "shall", "can", "could", "would", "should", "must", "may", "might", "i", "you", "we", "they", "he", "she", "it", "do", "does", "did", "not"]),
  // "don't" -> do not, "I'm" -> I am; "'s" is left to the lemmatizer
  expand(word, known) {
    const lw = word.toLowerCase().replace(/’/g, "'");
    if (!lw.includes("'") || known(lw)) return null;
    if (CONTRACTIONS[lw]) return CONTRACTIONS[lw];
    let m = lw.match(/^(.+)n't$/);
    if (m) return [m[1], "not"];
    m = lw.match(/^(.+)'(ll|ve|re|m|d)$/);
    if (m) return [m[1], CLITIC[m[2]]];
    return null;
  },
  grammar(toks, i, g) {
    const t = toks[i];
    const lw = t.surface.toLowerCase();
    if (lw === "will" || lw === "shall") {
      const j = g.forward(i, g.isInf, 3);
      if (j >= 0) g.setTense(t, j, "future");
    } else if (t.lemma === "have" && lw !== "have") {
      const j = g.forward(i, g.hasPart, 3);
      if (j >= 0) g.setTense(t, j, "past");
    } else if (lw === "did") {
      const j = g.forward(i, g.isInf, 3);
      if (j >= 0) g.setTense(t, j, "past");
    } else if (lw === "to") {
      const j = g.forward(i, g.isInf, 1);
      if (j === i + 1) t.drop = true;
    }
  },
};
