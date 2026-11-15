import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Translator } from "../js/translate.js";
import { layout } from "../js/layout.js";

const read = (p) => JSON.parse(fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const tr = new Translator(read("data/lexicon.json"), read("data/overrides.json"));
const label = (id) => tr.S[id][0];
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
  const baseCentre = base.x + tr.S[base.id][7];
  assert.ok(Math.abs(ind.x + ind.w / 2 - baseCentre) < 1);
  assert.ok(ind.y < base.y + 1, "indicator sits above the symbol");
});

test("layout wraps lines to the given width", () => {
  const t = syms("Ich gehe heute mit dem Hund in die Schule", { lang: "de" });
  const wide = layout(tr, t, { width: 4000, captions: true });
  const narrow = layout(tr, t, { width: 600, captions: true });
  assert.ok(narrow.height > wide.height);
});
