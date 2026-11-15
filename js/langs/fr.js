// French: lemmatizer, elision / contractions and grammar rules.
import { irregularTable, rules, applyRules, collector, words } from "./util.js";

// lemma|present|past (imparfait, passé simple)|participle|future
const IRREGULAR = irregularTable(`
être|suis es est sommes êtes sont sois soit soyons soyez soient|étais était étions étiez étaient fus fut furent|été|serai seras sera serons serez seront
avoir|ai as a avons avez ont aie aies ait ayons ayez aient|avais avait avions aviez avaient eus eut eurent|eu eue eus eues|aurai auras aura aurons aurez auront
aller|vais vas va allons allez vont aille ailles aillent|allais allait allions alliez allaient allai alla allèrent|allé allée allés allées|irai iras ira irons irez iront
faire|fais fait faisons faites font fasse fasses fassent|faisais faisait faisions faisiez faisaient fis fit firent|fait faite faits faites|ferai feras fera ferons ferez feront
pouvoir|peux peut pouvons pouvez peuvent puisse|pouvais pouvait pouvions pouviez pouvaient|pu|pourrai pourras pourra pourrons pourrez pourront
vouloir|veux veut voulons voulez veulent veuille|voulais voulait voulions vouliez voulaient|voulu|voudrai voudras voudra voudrons voudrez voudront
savoir|sais sait savons savez savent sache|savais savait savions saviez savaient|su|saurai sauras saura saurons saurez sauront
voir|vois voit voyons voyez voient|voyais voyait voyions voyiez voyaient vis vit virent|vu vue vus vues|verrai verras verra verrons verrez verront
venir|viens vient venons venez viennent vienne|venais venait venions veniez venaient vins vint vinrent|venu venue venus venues|viendrai viendras viendra viendrons viendrez viendront
devenir|deviens devient devenons devenez deviennent|devenais devenait|devenu devenue devenus devenues|deviendrai deviendras deviendra
tenir|tiens tient tenons tenez tiennent|tenais tenait|tenu tenue tenus tenues|tiendrai tiendras tiendra
dire|dis dit disons dites disent|disais disait disions disiez disaient dirent|dit dite dits dites|dirai diras dira dirons direz diront
prendre|prends prend prenons prenez prennent prenne|prenais prenait prenions preniez prenaient pris prit prirent|pris prise prises|prendrai prendras prendra prendrons prendrez prendront
apprendre|apprends apprend apprenons apprenez apprennent|apprenais apprenait|appris apprise apprises|apprendrai
comprendre|comprends comprend comprenons comprenez comprennent|comprenais comprenait|compris comprise comprises|comprendrai
mettre|mets met mettons mettez mettent mette|mettais mettait mettions mettiez mettaient mit mirent|mis mise mises|mettrai mettras mettra mettrons mettrez mettront
devoir|dois doit devons devez doivent doive|devais devait devions deviez devaient|dû due dus dues|devrai devras devra devrons devrez devront
recevoir|reçois reçoit recevons recevez reçoivent|recevais recevait|reçu reçue reçus reçues|recevrai recevras recevra
boire|bois boit buvons buvez boivent boive|buvais buvait buvions buviez buvaient|bu bue bus bues|boirai boiras boira boirons boirez boiront
lire|lis lit lisons lisez lisent|lisais lisait lisions lisiez lisaient|lu lue lus lues|lirai liras lira lirons lirez liront
écrire|écris écrit écrivons écrivez écrivent|écrivais écrivait écrivions écriviez écrivaient|écrit écrite écrits écrites|écrirai écriras écrira écrirons écrirez écriront
connaître|connais connaît connait connaissons connaissez connaissent|connaissais connaissait connaissions connaissiez connaissaient|connu connue connus connues|connaîtrai connaîtras connaîtra connaîtrons connaîtrez connaîtront
croire|crois croit croyons croyez croient|croyais croyait croyions croyiez croyaient|cru crue crus crues|croirai croiras croira croirons croirez croiront
vivre|vivons vivez vivent|vivais vivait vivions viviez vivaient|vécu vécue vécus vécues|vivrai vivras vivra vivrons vivrez vivront
ouvrir|ouvre ouvres ouvrons ouvrez ouvrent|ouvrais ouvrait|ouvert ouverte ouverts ouvertes|ouvrirai ouvriras ouvrira
offrir|offre offres offrons offrez offrent|offrais offrait|offert offerte offerts offertes|offrirai
partir|pars part partons partez partent|partais partait partions partiez partaient|parti partie partis parties|partirai partiras partira partirons partirez partiront
sortir|sors sort sortons sortez sortent|sortais sortait|sorti sortie sortis sorties|sortirai sortiras sortira
dormir|dors dort dormons dormez dorment|dormais dormait|dormi|dormirai dormiras dormira
courir|cours court courons courez courent|courais courait|couru courue courus courues|courrai courras courra
mourir|meurs meurt mourons mourez meurent|mourais mourait|mort morte morts mortes|mourrai mourras mourra
naître|nais naît naissons naissez naissent|naissais naissait|né née nés nées|naîtrai naîtras naîtra
envoyer|envoie envoies envoyons envoyez envoient|envoyais envoyait|envoyé envoyée envoyés envoyées|enverrai enverras enverra
falloir|faut|fallait|fallu|faudra
pleuvoir|pleut|pleuvait|plu|pleuvra
`);

const ARTICLES = new Set(["le", "la", "les", "l", "un", "une", "des"]);
const ELIDED = { l: "le", d: "de", j: "je", m: "me", t: "te", s: "se", n: "ne", c: "ce", qu: "que", jusqu: "jusque", lorsqu: "lorsque", puisqu: "puisque" };

// feminine / plural endings -> masculine singular (nouns and adjectives)
const NOUN_ADJ = rules([
  ["s", [""], { pl: true }], ["x", [""], { pl: true }], ["aux", ["al"], { pl: true }],
  ["es", [""], { pl: true }], ["e", [""]],
  ["ères", ["er"], { pl: true }], ["ère", ["er"]],
  ["euses", ["eux", "eur"], { pl: true }], ["euse", ["eux", "eur"]],
  ["trices", ["teur"], { pl: true }], ["trice", ["teur"]],
  ["ives", ["if"], { pl: true }], ["ive", ["if"]],
  ["elles", ["el"], { pl: true }], ["elle", ["el"]],
  ["iennes", ["ien"], { pl: true }], ["ienne", ["ien"]],
  ["onnes", ["on"], { pl: true }], ["onne", ["on"]],
  ["ettes", ["et"], { pl: true }], ["ette", ["et"]],
  ["ales", ["al"], { pl: true }], ["ale", ["al"]],
  ["ées", ["é"], { pl: true }], ["ée", ["é"]],
  ["ies", ["i"], { pl: true }], ["ie", ["i"]],
  ["ues", ["u"], { pl: true }], ["ue", ["u"]],
]);

const TENSE_E = ["ai", "as", "a", "ons", "ez", "ont"];
const IMPF_E = ["ais", "ait", "ions", "iez", "aient"];
const VERB = rules([
  // present
  ["", ["re"]], ["e", ["er"]], ["es", ["er"]], ["ent", ["er", "ir", "re"]], ["ons", ["er", "ir", "re"]], ["ez", ["er", "ir", "re"]],
  ["eons", ["er"]], ["s", ["ir", "re"]], ["ds", ["dre"]], ["d", ["dre"]], ["t", ["ir", "re"]],
  ["is", ["ir"]], ["it", ["ir"]], ["issons", ["ir"]], ["issez", ["ir"]], ["issent", ["ir"]],
  ["ète", ["eter", "éter"]], ["ètes", ["eter", "éter"]], ["ètent", ["eter", "éter"]],
  ["ère", ["erer", "érer"]], ["ères", ["erer", "érer"]], ["èrent", ["erer", "érer"], { past: true }],
  ["elle", ["eler"]], ["elles", ["eler"]], ["ette", ["eter"]], ["ettes", ["eter"]],
  ["oie", ["oyer"]], ["oies", ["oyer"]], ["aie", ["ayer"]], ["aies", ["ayer"]], ["oient", ["oyer"]],
  // imparfait and conditional
  ...IMPF_E.flatMap((e) => [
    [e, ["er", "ir", "re"], { past: true }],
    ["e" + e, ["er"], { past: true }],
    ["iss" + e, ["ir"], { past: true }],
    ...(e.startsWith("a") ? [["ç" + e, ["cer"], { past: true }]] : []),
    ["er" + e, ["er"]], ["ir" + e, ["ir"]], ["r" + e, ["re"]],
  ]),
  // future
  ...TENSE_E.flatMap((e) => [["er" + e, ["er"], { fut: true }], ["ir" + e, ["ir"], { fut: true }], ["r" + e, ["re"], { fut: true }]]),
  // passé simple
  ["a", ["er"], { past: true }], ["ea", ["er"], { past: true }], ["ça", ["cer"], { past: true }], ["irent", ["ir", "re"], { past: true }],
  // participles and gerund
  ["é", ["er"], { part: true }], ["ée", ["er"], { part: true }], ["és", ["er"], { part: true }], ["ées", ["er"], { part: true }],
  ["i", ["ir"], { part: true }], ["ie", ["ir"], { part: true }], ["is", ["ir"], { part: true }], ["ies", ["ir"], { part: true }],
  ["u", ["re"], { part: true }], ["ue", ["re"], { part: true }], ["us", ["re"], { part: true }], ["ues", ["re"], { part: true }],
  ["çons", ["cer"]], ["ant", ["er", "ir", "re"]], ["eant", ["er"]], ["issant", ["ir"]],
].map(([s, r, f]) => [s, r, { pos: "v", ...(f || {}) }]));

const adverbBases = (stem) => {
  const out = [stem, stem + "e"];
  const m = [];
  applyRules(stem, NOUN_ADJ, (l) => m.push(l));
  return out.concat(m);
};

function lemmas(word) {
  const w = word.toLowerCase().replace(/’/g, "'");
  const { cands, push } = collector();
  const irr = IRREGULAR.get(w);
  if (irr) push(irr.lemma, irr.feat);
  applyRules(w, NOUN_ADJ, push, 2);
  if (w.endsWith("ment") && w.length > 6) for (const b of adverbBases(w.slice(0, -4))) push(b, { pos: "a", adv: true });
  applyRules(w, VERB, push, 2);
  return cands;
}

export default {
  code: "fr",
  name: "Français",
  foldFallback: true,
  strict: true,
  articles: ARTICLES,
  particles: new Set(["ne"]),
  markers: new Set(words("le la les un une des du de et est sont je tu il elle nous vous ils elles ne pas que qui dans pour avec sur mais où au aux ce cet cette ces mon ma mes ton ta tes son sa ses notre votre leur leurs j qu suis es êtes ai as avons avez ont être avoir très aussi comme mes tes ses chez donc quand parce")),
  chars: /[îïûÿœë]/,
  lemmas,
  verbCues: new Set(words("je tu il elle on nous vous ils elles ne n se me te lui y en pas")),
  expand(word, known) {
    const lw = word.toLowerCase().replace(/’/g, "'");
    if (lw === "du") return ["de", "le"];
    if (lw === "au") return ["à", "le"];
    if (lw === "aux") return ["à", "les"];
    if (known(lw)) return null;
    if (lw === "s'il" || lw === "s'ils") return ["si", lw.slice(2)];
    const m = lw.match(/^(\p{L}+)'(.+)$/u);
    if (m && ELIDED[m[1]]) return [ELIDED[m[1]], ...(this.expand(m[2], known) || [m[2]])];
    // inversion: "a-t-il", "peut-il", "est-ce"
    const inv = lw.match(/^(.+?)(?:-t)?-(il|elle|on|ils|elles|je|tu|nous|vous|ce)$/);
    if (inv) return [inv[1], inv[2]];
    return null;
  },
  grammar(toks, i, g) {
    const t = toks[i];
    const lw = t.surface.toLowerCase();
    const finite = lw !== t.lemma && !t.feat.part && !t.feat.partAmb;
    if ((t.lemma === "avoir" || t.lemma === "être") && finite) {
      const j = g.forward(i, g.hasPart, 3);
      if (j >= 0) g.setTense(t, j, "past");
    } else if (t.lemma === "aller" && finite && !t.feat.past && !t.feat.fut) {
      const j = g.forward(i, g.isInf, 1);
      if (j === i + 1) g.setTense(t, j, "future");
    }
  },
};
