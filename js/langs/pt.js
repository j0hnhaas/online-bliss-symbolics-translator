// Portuguese: lemmatizer, contractions and grammar rules.
import { irregularTable, rules, applyRules, collector, words } from "./util.js";

// lemma|present|past (imperfeito, pretérito perfeito)|participle|future
const IRREGULAR = irregularTable(`
ser|sou és é somos são seja sejam|era eras éramos eram fui foi fomos foram|sido|serei serás será seremos serão
estar|estou estás está estamos estão esteja estejam|estava estavas estávamos estavam estive esteve estivemos estiveram|estado|estarei estarás estará estaremos estarão
ter|tenho tens tem temos têm tenha|tinha tinhas tínhamos tinham tive teve tivemos tiveram|tido|terei terás terá teremos terão
haver|hei há havemos hão haja|havia havias havíamos haviam houve houveram|havido|haverei haverás haverá haveremos haverão
ir|vou vais vai vamos vão vá|ia ias íamos iam|ido|irei irás irá iremos irão
fazer|faço fazes faz fazemos fazem faça|fazia fazias fazíamos faziam fiz fez fizemos fizeram|feito feita feitos feitas|farei farás fará faremos farão
poder|posso podes pode podemos podem possa|podia podias podíamos podiam pude pôde pudemos puderam|podido|poderei poderás poderá poderemos poderão
querer|quero queres quer queremos querem queira|queria querias queríamos queriam quis quisemos quiseram|querido|quererei quererás quererá quereremos quererão
dizer|digo dizes diz dizemos dizem diga|dizia dizias dizíamos diziam disse dissemos disseram|dito dita ditos ditas|direi dirás dirá diremos dirão
ver|vejo vês vê vemos veem veja|via vias víamos viam vi viu viram|visto vista vistos vistas|verei verás verá veremos verão
dar|dou dás dá damos dão dê|dava davas dávamos davam dei deu demos deram|dado|darei darás dará daremos darão
saber|sei sabes sabe sabemos sabem saiba|sabia sabias sabíamos sabiam soube soubemos souberam|sabido|saberei saberás saberá saberemos saberão
vir|venho vens vem vêm venha|vinha vinhas vínhamos vinham vim veio viemos vieram|vindo|virei virás virá viremos virão
pôr|ponho pões põe pomos põem ponha|punha punhas púnhamos punham pus pôs pusemos puseram|posto posta postos postas|porei porás porá poremos porão
ler|leio lês lê lemos leem leia|lia lias líamos liam li leu leram|lido|lerei lerás lerá leremos lerão
trazer|trago trazes traz trazemos trazem traga|trazia trazias trazíamos traziam trouxe trouxemos trouxeram|trazido|trarei trarás trará traremos trarão
sair|saio sais sai saímos saem saia|saía saías|saído|sairei sairás sairá
abrir|||aberto aberta abertos abertas|
escrever|||escrito escrita escritos escritas|
cobrir|||coberto coberta cobertos cobertas|
`);

const FIXED = { meus: "meu", minha: "meu", minhas: "meu", teus: "teu", tua: "teu", tuas: "teu", seus: "seu", sua: "seu", suas: "seu", nossos: "nosso", nossa: "nosso", nossas: "nosso", estes: "este", estas: "este", esta: "este", esses: "esse", essas: "esse", essa: "esse", todos: "todo", todas: "todo", muitos: "muito", muitas: "muito", muita: "muito", outros: "outro", outras: "outro", outra: "outro" };
const ARTICLES = new Set(["o", "a", "os", "as", "um", "uma", "uns", "umas"]);
// contractions: preposition + article
const CONTRACTIONS = {};
for (const [prep, forms] of Object.entries({
  de: "do da dos das dum duma duns dumas",
  em: "no na nos nas num numa nuns numas",
  para: "ao aos à às",
  por: "pelo pela pelos pelas",
})) for (const f of forms.split(" ")) CONTRACTIONS[f] = [prep, "o"];

const NOUN_ADJ = rules([
  ["es", ["", "e"], { pl: true }], ["s", [""], { pl: true }], ["ões", ["ão"], { pl: true }], ["ães", ["ão"], { pl: true }], ["ãos", ["ão"], { pl: true }],
  ["ais", ["al"], { pl: true }], ["eis", ["el"], { pl: true }], ["óis", ["ol"], { pl: true }], ["is", ["il"], { pl: true }],
  ["a", ["o", ""]], ["as", ["o", ""], { pl: true }], ["os", ["o"], { pl: true }],
  ["ora", ["or"]], ["oras", ["or"], { pl: true }], ["esa", ["ês"]], ["ona", ["ão"]],
]);

const VERB = rules([
  // present
  ["o", ["ar", "er", "ir"]], ["as", ["ar"]], ["a", ["ar"]], ["amos", ["ar"]], ["ais", ["ar"]], ["am", ["ar"]],
  ["es", ["er", "ir", "ar"]], ["e", ["er", "ir", "ar"]], ["emos", ["er", "ar"]], ["eis", ["er"]], ["em", ["er", "ir", "ar"]],
  ["imos", ["ir"]], ["is", ["ir"]], ["çar", ["car"]], ["ço", ["çar", "zer"]], ["go", ["ger", "gir"]],
  // imperfect
  ["ava", ["ar"], { past: true }], ["avas", ["ar"], { past: true }], ["ávamos", ["ar"], { past: true }], ["avam", ["ar"], { past: true }],
  ["ia", ["er", "ir"], { past: true }], ["ias", ["er", "ir"], { past: true }], ["íamos", ["er", "ir"], { past: true }], ["iam", ["er", "ir"], { past: true }],
  // pretérito perfeito
  ["ei", ["ar"], { past: true }], ["aste", ["ar"], { past: true }], ["ou", ["ar"], { past: true }], ["ámos", ["ar"], { past: true }], ["aram", ["ar"], { past: true }],
  ["i", ["er", "ir"], { past: true }], ["este", ["er"], { past: true }], ["iste", ["ir"], { past: true }], ["eu", ["er"], { past: true }], ["iu", ["ir"], { past: true }], ["eram", ["er"], { past: true }], ["iram", ["ir"], { past: true }],
  // future: infinitive + ending
  ...["ei", "ás", "á", "emos", "ão"].map((e) => [e, [""], { fut: true }]),
  // participles, gerund
  ...["o", "a", "os", "as"].flatMap((v) => [["ad" + v, ["ar"], { part: true }], ["id" + v, ["er", "ir"], { part: true }]]),
  ["ando", ["ar"]], ["endo", ["er"]], ["indo", ["ir"]],
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
  code: "pt",
  name: "Português",
  foldFallback: true,
  strict: true,
  aux: new Set(["haver"]),
  articles: ARTICLES,
  markers: new Set(words("o os as um uma uns umas é são eu tu ele ela nós vocês eles elas não que de em com por para mas ou como muito está estão sou és somos foi era do da dos das no na ao à este esta isso também mais meu meus minha você então porque quando")),
  chars: /[ãõ]/,
  lemmas,
  verbCues: new Set(words("eu tu ele ela nós vocês eles elas não se me te lhe")),
  expand(word) {
    return CONTRACTIONS[word.toLowerCase()] || null;
  },
  grammar(toks, i, g) {
    const t = toks[i];
    const lw = t.surface.toLowerCase();
    const finite = lw !== t.lemma && !t.feat.part && !t.feat.partAmb;
    if ((t.lemma === "ter" || t.lemma === "haver") && finite && lw !== "há") {
      const j = g.forward(i, g.hasPart, 2);
      if (j >= 0) g.setTense(t, j, "past");
    } else if (t.lemma === "ir" && finite && !t.feat.past && !t.feat.fut) {
      // "vou comer"
      const j = g.forward(i, g.isInf, 1);
      if (j === i + 1) g.setTense(t, j, "future");
    }
  },
};
