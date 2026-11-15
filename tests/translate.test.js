import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Translator, F } from "../js/translate.js";
import { CODES } from "../js/langs/index.js";
import { layout } from "../js/layout.js";

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const tr = new Translator(read("data/symbols.json"), read("data/overrides.json"));
for (const c of CODES) tr.addLanguage(c, read(`data/lang/${c}.json`));
const label = (id) => tr.S[id][F.LABEL];
const syms = (text, opts = {}) => tr.translate(text, opts).tokens;
const first = (tok) => label(tok.ids[tok.sel]);

test("language detection", () => {
  assert.equal(tr.detectLang("Ich gehe nach Hause und esse Brot."), "de");
  assert.equal(tr.detectLang("The children are eating bread at home."), "en");
});

test("German plural nouns get a plural indicator", () => {
  const [kinder, , aepfel] = syms("Die Kinder essen Äpfel");
  assert.equal(first(kinder), "child");
  assert.equal(tr.view(kinder).ind, "plural");
  assert.equal(first(aepfel), "apple");
  assert.equal(tr.view(aepfel).ind, "plural");
});

test("articles are skipped by default and can be kept", () => {
  assert.equal(syms("der Hund")[0].surface, "Hund");
  assert.equal(syms("der Hund", { skipArticles: false })[0].surface, "der");
});

test("German future: werden + infinitive becomes a future indicator", () => {
  const t = syms("Morgen werde ich nach Hause gehen");
  assert.ok(!t.some((x) => x.surface === "werde"));
  const gehen = t.find((x) => x.surface === "gehen");
  assert.equal(tr.view(gehen).ind, "future");
});

test("German perfect: haben + participle becomes past, aux is dropped", () => {
  const t = syms("Ich habe einen Film gesehen");
  assert.ok(!t.some((x) => x.surface === "habe"));
  assert.equal(tr.view(t.find((x) => x.surface === "gesehen")).ind, "past");
});

test("English irregular past and will-future", () => {
  assert.equal(tr.view(syms("I went home").find((x) => x.surface === "went")).ind, "past");
  const t = syms("She will go home");
  assert.ok(!t.some((x) => x.surface === "will"));
  assert.equal(tr.view(t.find((x) => x.surface === "go")).ind, "future");
});

test("German compounds are split with the head (classifier) first", () => {
  const [c] = syms("Haustür");
  assert.equal(c.kind, "cmp");
  assert.deepEqual(c.parts.map((p) => label(p.ids[0])), ["door", "house"]);
});

test("numbers become digit symbols, unknown words stay as text", () => {
  const [n] = syms("12");
  assert.equal(n.kind, "num");
  assert.deepEqual(n.ids.map(label), ["one (digit)", "two (digit)"]);
  assert.equal(syms("Fluxkompensator")[0].kind, "unk");
});

test("user choices override the default meaning", () => {
  const [g] = syms("gehen");
  const alt = g.ids[1];
  const [g2] = syms("gehen", { choices: { gehen: alt } });
  assert.equal(g2.ids[g2.sel], alt);
});

test("layout centres the indicator above the first character", () => {
  const t = syms("Kinder", { lang: "de" });
  const lay = layout(tr, t, { width: 2000, captions: false });
  const imgs = lay.items.filter((i) => i.t === "img");
  assert.equal(imgs.length, 2);
  const [base, ind] = imgs;
  const baseCentre = base.x + tr.S[base.id][F.CX];
  assert.ok(Math.abs(ind.x + ind.w / 2 - baseCentre) < 1);
  assert.ok(ind.y < base.y + 1, "indicator sits above the symbol");
});

test("layout wraps lines to the given width", () => {
  const t = syms("Ich gehe heute mit dem Hund in die Schule", { lang: "de" });
  const wide = layout(tr, t, { width: 4000, captions: true });
  const narrow = layout(tr, t, { width: 600, captions: true });
  assert.ok(narrow.height > wide.height);
});

// ------------------------------------------------------------ more languages

const words = (text, opts = {}) => syms(text, opts).filter((t) => t.kind === "sym" || t.kind === "unk");
const surfaces = (text, opts = {}) => syms(text, opts).map((t) => t.surface);
const find = (text, surface, opts = {}) => syms(text, opts).find((t) => t.surface === surface);

test("every language is detected from a typical sentence", () => {
  const cases = {
    de: "Wir gehen morgen ins Kino und essen Brot.",
    en: "We will go to the cinema tomorrow and eat bread.",
    fr: "Les enfants mangent des pommes à la maison.",
    es: "Hoy hay mucha gente en la plaza y los niños comen.",
    it: "I bambini mangiano le mele a casa con i miei amici.",
    pt: "Eu gosto de ler livros em casa com os meus amigos.",
    eo: "La infanoj manĝas pomojn en la domo.",
  };
  for (const [lang, text] of Object.entries(cases)) assert.equal(tr.detectLang(text), lang, text);
});

test("French: plural, elision, passé composé and aller + infinitive", () => {
  const t = syms("Les enfants mangent des pommes", { lang: "fr" });
  assert.equal(first(t[0]), "child");
  assert.equal(tr.view(t[0]).ind, "plural");
  assert.equal(tr.view(t.find((x) => x.surface === "pommes")).ind, "plural");

  const perfect = syms("Hier, j'ai vu mes amis à l'école.", { lang: "fr" });
  assert.ok(!perfect.some((x) => x.surface === "ai"), "auxiliary avoir is dropped");
  assert.equal(tr.view(perfect.find((x) => x.surface === "vu")).ind, "past");
  assert.equal(first(perfect.find((x) => x.surface === "école")), "school");

  const future = syms("Demain, nous allons manger avec ma mère.", { lang: "fr" });
  assert.ok(!future.some((x) => x.surface === "allons"));
  assert.equal(tr.view(future.find((x) => x.surface === "manger")).ind, "future");
});

test("French: ne is dropped, pas means not, du/au split into preposition + article", () => {
  assert.deepEqual(surfaces("Je ne suis pas là", { lang: "fr" }).slice(0, 3), ["Je", "suis", "pas"]);
  assert.equal(first(find("Je ne suis pas là", "pas", { lang: "fr" })), "not");
  assert.deepEqual(surfaces("le chien du voisin", { lang: "fr" }).slice(0, 2), ["chien", "de"]);
});

test("Spanish: plural, haber + participle, ir a + infinitive", () => {
  const t = syms("Los niños comen manzanas", { lang: "es" });
  assert.equal(tr.view(t[0]).ind, "plural");
  assert.equal(first(t.find((x) => x.surface === "manzanas")), "apple");

  const perfect = syms("Ella ha comido pan", { lang: "es" });
  assert.ok(!perfect.some((x) => x.surface === "ha"), "haber has no symbol and is consumed as auxiliary");
  assert.equal(tr.view(perfect.find((x) => x.surface === "comido")).ind, "past");

  const future = syms("Mañana voy a beber agua", { lang: "es" });
  assert.deepEqual(surfaces("Mañana voy a beber agua", { lang: "es" }), ["Mañana", "beber", "agua"]);
  assert.equal(first(future[0]), "tomorrow");
  assert.equal(tr.view(future.find((x) => x.surface === "beber")).ind, "future");
});

test("Spanish: possessives are not pluralised, al/del are split", () => {
  assert.equal(tr.view(find("Mis amigos", "Mis", { lang: "es" })).ind, null);
  assert.equal(tr.view(find("Mis amigos", "amigos", { lang: "es" })).ind, "plural");
  assert.deepEqual(surfaces("el perro del vecino", { lang: "es" }).slice(0, 2), ["perro", "de"]);
});

test("Italian: articulated prepositions, morphological future, essere + participle", () => {
  assert.deepEqual(surfaces("la casa dell'amico", { lang: "it" }).slice(0, 3), ["casa", "di", "amico"]);
  const future = syms("Domani berremo acqua", { lang: "it" });
  assert.equal(tr.view(future.find((x) => x.surface === "berremo")).ind, "future");
  const perfect = syms("Ieri sono andato a scuola", { lang: "it" });
  assert.ok(!perfect.some((x) => x.surface === "sono"));
  assert.equal(first(perfect.find((x) => x.surface === "andato")), "go");
  assert.equal(tr.view(perfect.find((x) => x.surface === "andato")).ind, "past");
});

test("Portuguese: contractions, ter + participle, ir + infinitive", () => {
  assert.deepEqual(surfaces("a casa do João", { lang: "pt" }).slice(0, 2), ["casa", "de"]);
  const perfect = syms("Eu tenho comido pão", { lang: "pt" });
  assert.ok(!perfect.some((x) => x.surface === "tenho"));
  assert.equal(tr.view(perfect.find((x) => x.surface === "comido")).ind, "past");
  const future = syms("Amanhã vou beber água", { lang: "pt" });
  assert.deepEqual(future.map((x) => x.surface), ["Amanhã", "beber", "água"]);
  assert.equal(tr.view(future[1]).ind, "future");
});

test("Esperanto: noun/adjective endings, tenses, x-system", () => {
  const t = syms("La infanoj manĝas pomojn", { lang: "eo" });
  assert.equal(t[0].surface, "infanoj");
  assert.equal(tr.view(t.find((x) => x.surface === "pomojn")).ind, "plural");
  assert.equal(tr.view(find("Mi iris hejmen", "iris", { lang: "eo" })).ind, "past");
  assert.equal(tr.view(find("Morgaŭ mi trinkos akvon", "trinkos", { lang: "eo" })).ind, "future");
  assert.equal(first(find("la gxardeno", "gxardeno", { lang: "eo" })), first(find("la ĝardeno", "ĝardeno", { lang: "eo" })));
});

test("accent-insensitive fallback for Romance languages", () => {
  assert.equal(first(syms("ecole", { lang: "fr" })[0]), "school");
  assert.equal(syms("ecole", { lang: "eo" })[0].kind, "unk");
});

test("verb endings never lead to unrelated non-verb words", () => {
  // "content" must not become "contre" (against) through a made-up verb ending
  assert.equal(syms("content", { lang: "fr" })[0].kind, "unk");
});

test("existing symbol alternatives keep working for every language", () => {
  for (const [lang, w] of [["fr", "maison"], ["es", "casa"], ["it", "casa"], ["pt", "casa"], ["eo", "domo"], ["de", "Haus"], ["en", "house"]]) {
    const [t] = syms(w, { lang });
    assert.equal(t.kind, "sym", `${lang}: ${w}`);
    assert.ok(["house", "home"].includes(first(t)), `${lang}: ${w} -> ${first(t)}`);
  }
});
