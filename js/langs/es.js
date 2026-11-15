// Spanish: lemmatizer, contractions and grammar rules.
import { irregularTable, rules, applyRules, collector, words } from "./util.js";

// lemma|present|past (imperfecto, indefinido)|participle|future
const IRREGULAR = irregularTable(`
ser|soy eres es somos sois son sea seas seamos seáis sean|era eras éramos erais eran fui fuiste fue fuimos fuisteis fueron|sido|seré serás será seremos seréis serán
estar|estoy estás está estamos estáis están esté estés estén|estaba estabas estábamos estabais estaban estuve estuviste estuvo estuvimos estuvisteis estuvieron|estado|estaré estarás estará estaremos estaréis estarán
tener|tengo tienes tiene tenemos tenéis tienen tenga|tenía tenías teníamos teníais tenían tuve tuviste tuvo tuvimos tuvisteis tuvieron|tenido|tendré tendrás tendrá tendremos tendréis tendrán
haber|he has ha hemos habéis han hay haya|había habías habíamos habíais habían hube hubo hubieron|habido|habré habrás habrá habremos habréis habrán
ir|voy vas va vamos vais van vaya|iba ibas íbamos ibais iban|ido|iré irás irá iremos iréis irán
hacer|hago haces hace hacemos hacéis hacen haga|hacía hacías hacíamos hacíais hacían hice hiciste hizo hicimos hicisteis hicieron|hecho hecha hechos hechas|haré harás hará haremos haréis harán
poder|puedo puedes puede podemos podéis pueden pueda|podía podías podíamos podíais podían pude pudiste pudo pudimos pudisteis pudieron|podido|podré podrás podrá podremos podréis podrán
querer|quiero quieres quiere queremos queréis quieren|quería querías queríamos queríais querían quise quisiste quiso quisimos quisisteis quisieron|querido|querré querrás querrá querremos querréis querrán
decir|digo dices dice decimos decís dicen|decía decías decíamos decíais decían dije dijiste dijo dijimos dijisteis dijeron|dicho dicha dichos dichas|diré dirás dirá diremos diréis dirán
ver|veo ves ve vemos veis ven|veía veías veíamos veíais veían vi viste vio vimos visteis vieron|visto vista vistos vistas|veré verás verá veremos veréis verán
dar|doy das da damos dais dan|daba dabas dábamos dabais daban di diste dio dimos disteis dieron|dado|daré darás dará daremos daréis darán
saber|sé sabes sabe sabemos sabéis saben sepa|sabía sabías sabíamos sabíais sabían supe supiste supo supimos supisteis supieron|sabido|sabré sabrás sabrá sabremos sabréis sabrán
venir|vengo vienes viene venimos venís vienen venga|venía venías veníamos veníais venían vine viniste vino vinimos vinisteis vinieron|venido|vendré vendrás vendrá vendremos vendréis vendrán
poner|pongo pones pone ponemos ponéis ponen ponga|ponía ponías poníamos poníais ponían puse pusiste puso pusimos pusisteis pusieron|puesto puesta puestos puestas|pondré pondrás pondrá pondremos pondréis pondrán
salir|salgo sales sale salimos salís salen salga|salía salías salíamos salíais salían|salido|saldré saldrás saldrá saldremos saldréis saldrán
traer|traigo traes trae traemos traéis traen traiga|traía traías traíamos traíais traían traje trajiste trajo trajimos trajisteis trajeron|traído|traeré traerás traerá
oír|oigo oyes oye oímos oís oyen|oía oías|oído|oiré
escribir|||escrito escrita escritos escritas|
abrir|||abierto abierta abiertos abiertas|
volver|vuelvo vuelves vuelve volvemos volvéis vuelven|||vuelto vuelta vueltos vueltas|
morir|muero mueres muere morimos morís mueren|murió murieron|muerto muerta muertos muertas|
romper|||roto rota rotos rotas|
cubrir|||cubierto cubierta cubiertos cubiertas|
`);

const FIXED = { mis: "mi", tus: "tu", sus: "su", nuestros: "nuestro", nuestras: "nuestro", nuestra: "nuestro", vuestros: "vuestro", vuestras: "vuestro", vuestra: "vuestro", estos: "este", estas: "este", esta: "este", esos: "ese", esas: "ese", esa: "ese", otros: "otro", otras: "otro", otra: "otro", todos: "todo", todas: "todo", todo: "todo", muchos: "mucho", muchas: "mucho", mucha: "mucho", pocos: "poco", pocas: "poco" };
const ARTICLES = new Set(["el", "la", "los", "las", "un", "una", "unos", "unas", "lo"]);

const NOUN_ADJ = rules([
  ["es", [""], { pl: true }], ["s", [""], { pl: true }], ["ces", ["z"], { pl: true }],
  ["a", ["o", ""]], ["as", ["o", ""], { pl: true }], ["os", ["o"], { pl: true }],
  ["ora", ["or"]], ["oras", ["or"], { pl: true }], ["esa", ["és"]], ["ina", ["ín"]], ["iones", ["ión"], { pl: true }],
]);

const TENSE_E = ["é", "ás", "á", "emos", "éis", "án"];
const VERB = rules([
  // present indicative / subjunctive
  ["o", ["ar", "er", "ir"]], ["as", ["ar"]], ["a", ["ar"]], ["amos", ["ar"]], ["áis", ["ar"]], ["an", ["ar"]],
  ["es", ["er", "ir"]], ["e", ["er", "ir", "ar"]], ["emos", ["er", "ar"]], ["éis", ["er", "ar"]], ["en", ["er", "ir", "ar"]],
  ["imos", ["ir"]], ["ís", ["ir"]], ["zco", ["cer", "cir"]], ["go", ["ger", "gir", "ar"]], ["jo", ["jar"]],
  // imperfect
  ["aba", ["ar"], { past: true }], ["abas", ["ar"], { past: true }], ["ábamos", ["ar"], { past: true }], ["abais", ["ar"], { past: true }], ["aban", ["ar"], { past: true }],
  ["ía", ["er", "ir"], { past: true }], ["ías", ["er", "ir"], { past: true }], ["íamos", ["er", "ir"], { past: true }], ["íais", ["er", "ir"], { past: true }], ["ían", ["er", "ir"], { past: true }],
  // preterite
  ["é", ["ar"], { past: true }], ["aste", ["ar"], { past: true }], ["ó", ["ar"], { past: true }], ["asteis", ["ar"], { past: true }], ["aron", ["ar"], { past: true }],
  ["í", ["er", "ir"], { past: true }], ["iste", ["er", "ir"], { past: true }], ["ió", ["er", "ir"], { past: true }], ["isteis", ["er", "ir"], { past: true }], ["ieron", ["er", "ir"], { past: true }],
  ["yó", ["er", "ir"], { past: true }], ["yeron", ["er", "ir"], { past: true }],
  // future: infinitive + ending
  ...TENSE_E.map((e) => [e, [""], { fut: true }]),
  // participles, gerund
  ["ado", ["ar"], { part: true }], ["ada", ["ar"], { part: true }], ["ados", ["ar"], { part: true }], ["adas", ["ar"], { part: true }],
  ["ido", ["er", "ir"], { part: true }], ["ida", ["er", "ir"], { part: true }], ["idos", ["er", "ir"], { part: true }], ["idas", ["er", "ir"], { part: true }],
  ["ando", ["ar"]], ["iendo", ["er", "ir"]], ["yendo", ["er", "ir"]],
].map(([s, r, f]) => [s, r, { pos: "v", ...(f || {}) }]));

// stem changes in the present: p-ue-do -> poder, p-ie-nso -> pensar, p-i-do -> pedir
const stemBack = (stem) => {
  const out = [];
  for (const [from, tos] of [["ue", ["o", "u"]], ["ie", ["e"]], ["i", ["e"]]]) {
    const k = stem.lastIndexOf(from);
    if (k >= 0) for (const to of tos) out.push(stem.slice(0, k) + to + stem.slice(k + from.length));
  }
  return out;
};
const PRESENT_ENDINGS = ["o", "es", "as", "e", "a", "en", "an"];

function lemmas(word) {
  const w = word.toLowerCase().replace(/’/g, "'");
  const { cands, push } = collector();
  const irr = IRREGULAR.get(w);
  if (irr) push(irr.lemma, irr.feat);
  if (FIXED[w]) push(FIXED[w], { irreg: true }); // possessives are not pluralised
  applyRules(w, NOUN_ADJ, push, 2);
  if (w.endsWith("mente") && w.length > 8) {
    const base = w.slice(0, -5);
    push(base, { pos: "a", adv: true });
    applyRules(base, NOUN_ADJ, (l) => push(l, { pos: "a", adv: true }), 2);
  }
  // verb rules; the future/conditional endings attach to the whole infinitive
  const verbs = [];
  applyRules(w, VERB, (l, f) => verbs.push([l, f]), 2);
  for (const [l, f] of verbs) push(l, f);
  for (const e of PRESENT_ENDINGS) {
    if (!w.endsWith(e)) continue;
    const stem = w.slice(0, -e.length);
    for (const s of stemBack(stem)) for (const inf of ["ar", "er", "ir"]) push(s + inf, { pos: "v" });
  }
  return cands;
}

export default {
  code: "es",
  name: "Español",
  foldFallback: true,
  strict: true,
  aux: new Set(["haber"]),
  articles: ARTICLES,
  markers: new Set(words("el la los las un una unos unas y es son yo tú usted ustedes nosotros ellos ella no que de en con por para pero o como muy está están soy eres somos fue era al del esto esta este estos esos esas del también más pero porque cuando donde así mi mis tu su hay")),
  chars: /ñ/,
  lemmas,
  verbCues: new Set(words("yo tú él ella usted nosotros vosotros ellos ellas ustedes no se me te nos lo la le les")),
  expand(word) {
    const lw = word.toLowerCase();
    if (lw === "al") return ["a", "el"];
    if (lw === "del") return ["de", "el"];
    return null;
  },
  grammar(toks, i, g) {
    const t = toks[i];
    const lw = t.surface.toLowerCase();
    const finite = lw !== t.lemma && !t.feat.part && !t.feat.partAmb;
    if (t.lemma === "haber" && finite && lw !== "hay") {
      const j = g.forward(i, g.hasPart, 2);
      if (j >= 0) g.setTense(t, j, "past");
    } else if (t.lemma === "ir" && finite && !t.feat.past && !t.feat.fut) {
      // "voy a comer"
      const a = toks[i + 1];
      if (a && a.kind === "sym" && a.surface.toLowerCase() === "a") {
        const j = g.forward(i + 1, g.isInf, 1);
        if (j === i + 2) {
          a.drop = true;
          g.setTense(t, j, "future");
        }
      }
    }
  },
};
