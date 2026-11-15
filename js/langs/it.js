// Italian: lemmatizer, elision / articulated prepositions and grammar rules.
import { irregularTable, rules, applyRules, collector, words } from "./util.js";

// lemma|present|past (imperfetto, passato remoto)|participle|future
const IRREGULAR = irregularTable(`
essere|sono sei è siamo siete sia siano|ero eri era eravamo eravate erano fui fosti fu fummo foste furono|stato stata stati state|sarò sarai sarà saremo sarete saranno
avere|ho hai ha abbiamo avete hanno abbia|avevo avevi aveva avevamo avevate avevano ebbi ebbe ebbero|avuto avuta avuti avute|avrò avrai avrà avremo avrete avranno
andare|vado vai va andiamo andate vanno vada|andavo andavi andava andavamo andavate andavano andai andò|andato andata andati andate|andrò andrai andrà andremo andrete andranno
fare|faccio fai fa facciamo fate fanno faccia|facevo facevi faceva facevamo facevate facevano feci fece fecero|fatto fatta fatti fatte|farò farai farà faremo farete faranno
stare|sto stai sta stiamo stanno stia|stavo stavi stava stavamo stavate stavano stetti stette|stato|starò starai starà staremo starete staranno
potere|posso puoi può possiamo potete possono possa|potevo potevi poteva potevamo potevate potevano potei potette|potuto|potrò potrai potrà potremo potrete potranno
volere|voglio vuoi vuole vogliamo volete vogliono voglia|volevo volevi voleva volevamo volevate volevano volli volle|voluto|vorrò vorrai vorrà vorremo vorrete vorranno
dovere|devo devi deve dobbiamo dovete devono debba|dovevo dovevi doveva dovevamo dovevate dovevano|dovuto|dovrò dovrai dovrà dovremo dovrete dovranno
dire|dico dici dice diciamo dite dicono dica|dicevo dicevi diceva dicevamo dicevate dicevano dissi disse dissero|detto detta detti dette|dirò dirai dirà diremo direte diranno
vedere|vedo vedi vede vediamo vedete vedono|vedevo vedevi vedeva vedevamo vedevate vedevano vidi vide videro|visto vista visti viste|vedrò vedrai vedrà vedremo vedrete vedranno
venire|vengo vieni viene veniamo venite vengono venga|venivo venivi veniva venivamo venivate venivano venni venne vennero|venuto venuta venuti venute|verrò verrai verrà verremo verrete verranno
sapere|so sai sa sappiamo sapete sanno sappia|sapevo sapevi sapeva sapevamo sapevate sapevano seppi seppe|saputo|saprò saprai saprà sapremo saprete sapranno
dare|do dai dà diamo date danno dia|davo davi dava davamo davate davano diedi diede diedero|dato|darò darai darà daremo darete daranno
bere|bevo bevi beve beviamo bevete bevono beva|bevevo bevevi beveva bevevamo bevevate bevevano bevvi bevve|bevuto|berrò berrai berrà berremo berrete berranno
uscire|esco esci esce usciamo uscite escono|uscivo uscivi usciva|uscito uscita usciti uscite|uscirò uscirai uscirà
morire|muoio muori muore moriamo morite muoiono|morì|morto morta morti morte|morirò morirai morirà
rimanere|rimango rimani rimane rimaniamo rimanete rimangono|rimasi rimase|rimasto rimasta rimasti rimaste|rimarrò rimarrai rimarrà
leggere|||letto letta letti lette|
scrivere|||scritto scritta scritti scritte|
prendere|||preso presa presi prese|
mettere|||messo messa messi messe|
aprire|||aperto aperta aperti aperte|
chiudere|||chiuso chiusa chiusi chiuse|
vivere|||vissuto vissuta vissuti vissute|
`);

const FIXED = { mia: "mio", miei: "mio", mie: "mio", tua: "tuo", tuoi: "tuo", tue: "tuo", sua: "suo", suoi: "suo", sue: "suo", nostra: "nostro", nostri: "nostro", nostre: "nostro", vostra: "vostro", vostri: "vostro", vostre: "vostro", questa: "questo", questi: "questo", queste: "questo", quella: "quello", quelli: "quello", quelle: "quello", tutti: "tutto", tutte: "tutto", tutta: "tutto" };
const ARTICLES = new Set(["il", "lo", "la", "l", "i", "gli", "le", "un", "uno", "una"]);

// articulated prepositions: preposition + article
const ARTICULATED = {};
for (const [prep, forms] of Object.entries({
  di: "del dello della dei degli delle dell'",
  a: "al allo alla ai agli alle all'",
  da: "dal dallo dalla dai dagli dalle dall'",
  in: "nel nello nella nei negli nelle nell'",
  su: "sul sullo sulla sui sugli sulle sull'",
  con: "col coi",
})) for (const f of forms.split(" ")) ARTICULATED[f] = [prep, "il"];
// elided pronouns / articles before a vowel
const ELIDED = { l: "la", un: "una", d: "di", m: "mi", t: "ti", s: "si", n: "ne", v: "vi", c: "ci", quest: "questa", quell: "quella", dov: "dove", com: "come", cos: "cosa", anch: "anche", nient: "niente" };

const NOUN_ADJ = rules([
  ["i", ["o", "e", "io"], { pl: true }], ["e", ["a", "e"], { pl: true }], ["a", ["o"]],
  ["ci", ["co"], { pl: true }], ["chi", ["co"], { pl: true }], ["gi", ["go"], { pl: true }], ["ghi", ["go"], { pl: true }],
  ["che", ["ca"], { pl: true }], ["ghe", ["ga"], { pl: true }], ["cie", ["cia"], { pl: true }],
  ["ori", ["ore"], { pl: true }], ["ssa", ["sso"]], ["trice", ["tore"]], ["tori", ["tore"], { pl: true }],
]);

const VERB = rules([
  // present
  ["o", ["are", "ere", "ire"]], ["i", ["are", "ere", "ire"]], ["a", ["are"]], ["e", ["ere", "ire", "are"]],
  ["iamo", ["are", "ere", "ire"]], ["ate", ["are"]], ["ete", ["ere"]], ["ite", ["ire"]],
  ["ano", ["are"]], ["ono", ["ere", "ire"]], ["isco", ["ire"]], ["isci", ["ire"]], ["isce", ["ire"]], ["iscono", ["ire"]],
  ["ghi", ["gare"]], ["chi", ["care"]], ["ci", ["ciare", "cere"]],
  // imperfect
  ["avo", ["are"], { past: true }], ["avi", ["are"], { past: true }], ["ava", ["are"], { past: true }], ["avamo", ["are"], { past: true }], ["avate", ["are"], { past: true }], ["avano", ["are"], { past: true }],
  ["evo", ["ere"], { past: true }], ["evi", ["ere"], { past: true }], ["eva", ["ere"], { past: true }], ["evamo", ["ere"], { past: true }], ["evate", ["ere"], { past: true }], ["evano", ["ere"], { past: true }],
  ["ivo", ["ire"], { past: true }], ["ivi", ["ire"], { past: true }], ["iva", ["ire"], { past: true }], ["ivamo", ["ire"], { past: true }], ["ivate", ["ire"], { past: true }], ["ivano", ["ire"], { past: true }],
  // passato remoto
  ["ai", ["are"], { past: true }], ["asti", ["are"], { past: true }], ["ò", ["are"], { past: true }], ["ammo", ["are"], { past: true }], ["aste", ["are"], { past: true }], ["arono", ["are"], { past: true }],
  ["ei", ["ere"], { past: true }], ["esti", ["ere"], { past: true }], ["é", ["ere"], { past: true }], ["emmo", ["ere"], { past: true }], ["este", ["ere"], { past: true }], ["erono", ["ere"], { past: true }],
  ["ii", ["ire"], { past: true }], ["isti", ["ire"], { past: true }], ["ì", ["ire"], { past: true }], ["immo", ["ire"], { past: true }], ["iste", ["ire"], { past: true }], ["irono", ["ire"], { past: true }],
  // future ("parlerò" -> parlare, "venderò" -> vendere, "partirò" -> partire)
  ...["ò", "ai", "à", "emo", "ete", "anno"].flatMap((e) => [["er" + e, ["are", "ere"], { fut: true }], ["ir" + e, ["ire"], { fut: true }]]),
  // participles, gerund, reflexive infinitive
  ...["o", "a", "i", "e"].flatMap((v) => [["at" + v, ["are"], { part: true }], ["ut" + v, ["ere"], { part: true }], ["it" + v, ["ire"], { part: true }]]),
  ["ando", ["are"]], ["endo", ["ere", "ire"]],
  ["arsi", ["are"]], ["ersi", ["ere"]], ["irsi", ["ire"]],
].map(([s, r, f]) => [s, r, { pos: "v", ...(f || {}) }]));

function lemmas(word) {
  const w = word.toLowerCase().replace(/’/g, "'");
  const { cands, push } = collector();
  const irr = IRREGULAR.get(w);
  if (irr) push(irr.lemma, irr.feat);
  if (FIXED[w]) push(FIXED[w], { irreg: true }); // possessives are not pluralised
  applyRules(w, NOUN_ADJ, push, 2);
  if (w.endsWith("mente") && w.length > 8) {
    const base = w.slice(0, -5);
    for (const b of [base, base + "e", base.endsWith("a") ? base.slice(0, -1) + "o" : null]) b && push(b, { pos: "a", adv: true });
  }
  applyRules(w, VERB, push, 2);
  return cands;
}

export default {
  code: "it",
  name: "Italiano",
  foldFallback: true,
  strict: true,
  articles: ARTICLES,
  markers: new Set(words("il lo la le gli un uno una è sono io tu lui lei noi voi loro non che di in con per ma o come molto sta stanno sei siamo era del della dei delle al alla nel nella questo questa anche più ho hai ha abbiamo hanno i a mia miei gli degli nella sulla perché però quando dove quindi cosa mamma")),
  chars: /[ìò]/,
  lemmas,
  verbCues: new Set(words("io tu lui lei noi voi loro non si mi ti ci vi")),
  expand(word, known) {
    const lw = word.toLowerCase().replace(/’/g, "'");
    if (ARTICULATED[lw]) return ARTICULATED[lw];
    if (known(lw)) return null;
    const m = lw.match(/^(\p{L}+)'(.+)$/u);
    if (m && ARTICULATED[m[1] + "'"]) return [...ARTICULATED[m[1] + "'"], m[2]];
    if (m && ELIDED[m[1]]) return [ELIDED[m[1]], ...(this.expand(m[2], known) || [m[2]])];
    return null;
  },
  grammar(toks, i, g) {
    const t = toks[i];
    const lw = t.surface.toLowerCase();
    const finite = lw !== t.lemma && !t.feat.part && !t.feat.partAmb;
    if ((t.lemma === "avere" || t.lemma === "essere") && finite) {
      const j = g.forward(i, g.hasPart, 2);
      if (j >= 0) g.setTense(t, j, "past");
    }
  },
};
