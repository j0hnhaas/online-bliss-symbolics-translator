// Small rule-based lemmatizers for German and English.
//
// They return an ordered list of candidate base forms for a word. The translator
// tries each candidate against the Bliss lexicon and uses the first one found, so
// rules may over-generate. `feat` carries grammatical hints:
//   pl    plural noun form          past  simple past
//   part  past participle           inf   infinitive / plain base form
//   pos   expected part of speech: n noun, v verb, a adjective

// ---------------------------------------------------------------- German

// lemma, present forms, past forms, participle
const DE_VERBS = `
sein|bin bist ist sind seid sei seien|war warst waren wart wäre wären|gewesen
haben|habe hast hat habt|hatte hattest hatten hattet hätte hätten|gehabt
werden|werde wirst wird werdet|wurde wurden wurdest wurdet|geworden worden
gehen|gehe gehst geht|ging gingen gingst gingt|gegangen
kommen|komme kommst kommt|kam kamen kamst kamt|gekommen
essen|esse isst|aß aßen aßt|gegessen
trinken|trinke trinkst trinkt|trank tranken trankst|getrunken
sehen|sehe siehst sieht seht|sah sahen sahst|gesehen
geben|gebe gibst gibt gebt|gab gaben gabst|gegeben
nehmen|nehme nimmst nimmt nehmt|nahm nahmen nahmst|genommen
schlafen|schlafe schläfst schläft|schlief schliefen|geschlafen
fahren|fahre fährst fährt|fuhr fuhren fuhrst|gefahren
laufen|laufe läufst läuft|lief liefen|gelaufen
sprechen|spreche sprichst spricht sprecht|sprach sprachen|gesprochen
lesen|lese liest lest|las lasen|gelesen
schreiben||schrieb schrieben|geschrieben
finden||fand fanden|gefunden
stehen||stand standen|gestanden
sitzen||saß saßen|gesessen
liegen||lag lagen|gelegen
bringen||brachte brachten|gebracht
denken||dachte dachten|gedacht
wissen|weiß weißt wisst|wusste wussten|gewusst
können|kann kannst könnt|konnte konnten|gekonnt
müssen|muss musst müsst|musste mussten|gemusst
wollen|will willst wollt|wollte wollten|gewollt
sollen|soll sollst sollt|sollte sollten|gesollt
dürfen|darf darfst dürft|durfte durften|gedurft
mögen|mag magst mögt|mochte mochten|gemocht
tun|tue tust tut|tat taten|getan
singen||sang sangen|gesungen
helfen|helfe hilfst hilft helft|half halfen|geholfen
bleiben||blieb blieben|geblieben
schwimmen||schwamm schwammen|geschwommen
rufen||rief riefen|gerufen
lassen|lasse lässt|ließ ließen|gelassen
halten|halte hältst hält|hielt hielten|gehalten
fallen|falle fällst fällt|fiel fielen|gefallen
heißen||hieß hießen|geheißen
nennen||nannte nannten|genannt
kennen||kannte kannten|gekannt
rennen||rannte rannten|gerannt
schneiden||schnitt schnitten|geschnitten
ziehen||zog zogen|gezogen
fliegen||flog flogen|geflogen
werfen|werfe wirfst wirft|warf warfen|geworfen
treffen|treffe triffst trifft|traf trafen|getroffen
beginnen||begann begannen|begonnen
gewinnen||gewann gewannen|gewonnen
sterben|sterbe stirbst stirbt|starb starben|gestorben
verstehen||verstand verstanden|verstanden
vergessen|vergesse vergisst|vergaß vergaßen|vergessen
bekommen||bekam bekamen|bekommen
sagen||sagte sagten|gesagt
`;

const DE_ADJ = { besser: "gut", beste: "gut", besten: "gut", bestes: "gut", bester: "gut", am: "", mehr: "viel", meiste: "viel", meisten: "viel", höher: "hoch", hohe: "hoch", hohen: "hoch", hoher: "hoch", hohes: "hoch", nähere: "nah" };

const deIrregular = new Map();
for (const line of DE_VERBS.trim().split("\n")) {
  const [lemma, pres, past, part] = line.split("|");
  for (const f of (pres || "").split(" ").filter(Boolean)) deIrregular.set(f, { lemma, feat: { pos: "v", irreg: true } });
  for (const f of (past || "").split(" ").filter(Boolean)) deIrregular.set(f, { lemma, feat: { pos: "v", past: true, irreg: true } });
  for (const f of (part || "").split(" ").filter(Boolean)) if (!deIrregular.has(f)) deIrregular.set(f, { lemma, feat: { pos: "v", part: true, irreg: true } });
}

const deUmlautBackLast = (w) => {
  // revert the umlaut of the last umlauted vowel (Häuser -> Hauser handled by caller)
  const m = [...w.matchAll(/[äöü]/g)].pop();
  if (!m) return null;
  const rep = { ä: "a", ö: "o", ü: "u" }[m[0]];
  let out = w.slice(0, m.index) + rep + w.slice(m.index + 1);
  if (m[0] === "ä" && w[m.index + 1] === "u") out = w.slice(0, m.index) + "a" + w.slice(m.index + 1); // äu -> au
  return out;
};

/** Spelling variants for people typing without umlauts / ß. */
export function deVariants(w) {
  const out = new Set([w]);
  const add = (x) => x !== w && out.add(x);
  if (/ss/.test(w)) add(w.replace(/ss/g, "ß"));
  if (/ae|oe|ue/.test(w)) {
    add(w.replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü"));
    // "quelle", "neue": only replace where it is not a real digraph is impossible to know;
    // the translator tries the plain form first, so this is a safe fallback.
  }
  return [...out];
}

export function lemmasDe(word, { sentenceStart = false } = {}) {
  const original = word;
  const w = word.toLowerCase();
  const cands = [];
  const push = (lemma, feat = {}) => {
    if (lemma && lemma.length >= 2) cands.push({ lemma, feat });
  };

  if (deIrregular.has(w)) {
    const { lemma, feat } = deIrregular.get(w);
    push(lemma, feat);
  }
  if (DE_ADJ[w]) push(DE_ADJ[w], { pos: "a", irreg: true });

  const capital = original[0] !== original[0].toLowerCase() && !sentenceStart;

  // past participle: ge-...-t / ge-...-en / ge-...-et
  if (/^ge.{3,}(t|en|et)$/.test(w)) {
    const b = w.slice(2);
    if (b.endsWith("et")) push(b.slice(0, -2) + "en", { pos: "v", part: true });
    if (b.endsWith("t")) push(b.slice(0, -1) + "en", { pos: "v", part: true });
    if (b.endsWith("en")) push(b, { pos: "v", part: true });
  }
  // separable-prefix participles: aufgeräumt, eingekauft, mitgenommen
  const sep = w.match(/^(auf|an|ab|aus|ein|mit|nach|vor|zu|weg|zurück|her|hin|fest)ge(.{2,})$/);
  if (sep) {
    const [, pre, rest] = sep;
    if (rest.endsWith("t")) push(pre + rest.slice(0, -1) + "en", { pos: "v", part: true });
    if (rest.endsWith("en")) push(pre + rest, { pos: "v", part: true });
  }

  // noun plural / case forms (tried before verb endings for capitalised words)
  const nounRules = () => {
    const strip = (suf, feat = { pl: true, pos: "n" }) => {
      if (w.endsWith(suf) && w.length - suf.length >= 2) {
        const stem = w.slice(0, -suf.length);
        push(stem, feat);
        const back = deUmlautBackLast(stem);
        if (back) push(back, feat);
      }
    };
    const umlautOnly = deUmlautBackLast(w);
    if (umlautOnly) push(umlautOnly, { pl: true, pos: "n" });
    strip("innen");
    strip("nen");
    strip("en");
    strip("er");
    strip("e");
    strip("n");
    strip("se");
    strip("s", { pos: "n" }); // Autos / genitive -s
    strip("es", { pos: "n" });
  };

  const verbRules = () => {
    const ends = [
      ["etest", "past"], ["eten", "past"], ["etet", "past"], ["ete", "past"],
      ["test", "past"], ["ten", "past"], ["tet", "past"], ["te", "past"],
      ["est", ""], ["et", ""], ["st", ""], ["en", "inf"], ["n", "inf"], ["t", ""], ["e", ""],
    ];
    for (const [suf, kind] of ends) {
      if (!w.endsWith(suf) || w.length - suf.length < 2) continue;
      const stem = w.slice(0, -suf.length);
      const feat = { pos: "v" };
      if (kind === "past") feat.past = true;
      if (kind === "inf") feat.inf = true;
      push(stem + "en", feat);
      if (/(el|er)$/.test(stem)) push(stem + "n", feat);
      const back = deUmlautBackLast(stem);
      if (back) push(back + "en", feat);
      if (kind === "inf") push(stem, feat);
    }
  };

  const adjRules = () => {
    for (const suf of ["en", "em", "er", "es", "e"]) {
      if (w.endsWith(suf) && w.length - suf.length >= 2) {
        push(w.slice(0, -suf.length), { pos: "a" });
      }
    }
    // comparative / superlative: schöner, schönste(n)
    for (const suf of ["ere", "eren", "erer", "eres", "er"]) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) push(w.slice(0, -suf.length), { pos: "a" });
    }
    for (const suf of ["ste", "sten", "ster", "stes", "st"]) {
      if (w.endsWith(suf) && w.length - suf.length >= 3) push(w.slice(0, -suf.length), { pos: "a" });
    }
  };

  if (capital) {
    nounRules();
    adjRules();
    verbRules();
  } else {
    verbRules();
    adjRules();
    nounRules();
  }
  return cands;
}

/** Split an unknown German compound into [head, modifier] lexicon terms. */
export function compoundSplitsDe(word, known) {
  const w = word.toLowerCase();
  const out = [];
  for (let i = w.length - 3; i >= 3; i--) {
    const left = w.slice(0, i);
    const right = w.slice(i);
    const lefts = [left];
    for (const fuge of ["es", "en", "ns", "s", "n", "e"]) if (left.endsWith(fuge) && left.length - fuge.length >= 3) lefts.push(left.slice(0, -fuge.length));
    for (const l of lefts) {
      const rights = [right];
      if (right.startsWith("-")) rights.push(right.slice(1));
      for (const r of rights) {
        const hl = known(l);
        const hr = known(r);
        if (hl && hr) out.push({ head: hr, modifier: hl, headWord: r, modWord: l });
      }
    }
    if (out.length) break; // longest head wins
  }
  return out[0] || null;
}

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
