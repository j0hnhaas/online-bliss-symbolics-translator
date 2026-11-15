import { Translator, labelFor } from "./translate.js";
import { layout, toSvg } from "./layout.js";
import { GOATCOUNTER, REPO_URL } from "./config.js";

const I18N = {
  de: {
    title: "Bliss-Übersetzer",
    tagline: "Deutschen oder englischen Text in Blissymbole umwandeln",
    inputHeading: "Eingabe",
    inputLabel: "Dein Text",
    placeholder: "Schreibe hier einen deutschen oder englischen Text …",
    langAuto: "Auto",
    optCaptions: "Wörter darunter",
    optArticles: "Artikel weglassen",
    optGrammar: "Zeit & Plural",
    optSize: "Größe",
    examples: "Beispiele",
    outputLabel: "Blissymbole",
    btnPng: "PNG",
    btnSvg: "SVG",
    btnPrint: "Drucken",
    btnLink: "Link kopieren",
    linkCopied: "Link kopiert",
    btnInstall: "App installieren",
    btnOffline: "Alle Symbole offline laden (≈ 5 MB)",
    offlineProgress: (n, total) => `Lade Symbole … ${n} / ${total}`,
    offlineReady: "Offline bereit: alle Symbole sind gespeichert.",
    offlineFail: "Das Laden wurde unterbrochen. Bereits geladene Symbole bleiben erhalten.",
    iosHint: "Zum Installieren auf dem iPhone/iPad: Teilen-Symbol antippen und „Zum Home-Bildschirm“ wählen.",
    loading: "Lade Vokabular …",
    loadError: "Das Vokabular konnte nicht geladen werden. Bitte Seite neu laden.",
    hint: "Tipp: Auf ein Symbol klicken, um eine andere Bedeutung zu wählen.",
    empty: "Hier erscheinen die Symbole, sobald du etwas schreibst.",
    detected: (l) => `Erkannte Sprache: <b>${l === "de" ? "Deutsch" : "Englisch"}</b>`,
    nSymbols: (n) => `${n} ${n === 1 ? "Symbol" : "Symbole"}`,
    missing: "Ohne Symbol",
    altsFor: (w) => `Bedeutung für „${w}“`,
    noAlt: "Für dieses Wort gibt es kein Symbol im BCI-Vokabular. Es wird als Text angezeigt.",
    compound: "Zusammengesetztes Wort: Bliss beginnt mit dem Oberbegriff (Klassifikator).",
    pos: { n: "Ding", v: "Handlung", p: "Person", a: "Eigenschaft", o: "Sonstiges", g: "Ausruf" },
    privacy: "Diese Seite zählt Besuche anonym mit GoatCounter (ohne Cookies). Der eingegebene Text bleibt in deinem Browser.",
    footerLicense: `Blissymbole © <a href="https://www.blissymbolics.org/" rel="noopener">Blissymbolics Communication International (BCI)</a>, Vokabular BCI-AV 2026-09-12, <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.de" rel="noopener">CC BY-SA 4.0</a>. Daten in <code>symbols/</code> und <code>data/</code> stehen unter derselben Lizenz; der Programmcode unter MIT (<a href="${REPO_URL}" rel="noopener">GitHub</a>).`,
    footerNote: "Inoffizielles Hilfsmittel: Die Zuordnung erfolgt wortweise anhand des BCI-Vokabulars. Tempus- und Plural-Indikatoren werden nach den BCI Fundamental Rules über das erste Zeichen gesetzt. Für Bliss-Grammatik und Lernen siehe blissymbolics.org.",
  },
  en: {
    title: "Bliss Translator",
    tagline: "Turn German or English text into Blissymbols",
    inputHeading: "Input",
    inputLabel: "Your text",
    placeholder: "Type some German or English text here …",
    langAuto: "Auto",
    optCaptions: "Words underneath",
    optArticles: "Skip articles",
    optGrammar: "Tense & plural",
    optSize: "Size",
    examples: "Examples",
    outputLabel: "Blissymbols",
    btnPng: "PNG",
    btnSvg: "SVG",
    btnPrint: "Print",
    btnLink: "Copy link",
    linkCopied: "Link copied",
    btnInstall: "Install app",
    btnOffline: "Download all symbols for offline use (≈ 5 MB)",
    offlineProgress: (n, total) => `Downloading symbols … ${n} / ${total}`,
    offlineReady: "Ready offline: all symbols are stored.",
    offlineFail: "Download interrupted. Symbols already loaded are kept.",
    iosHint: "To install on iPhone/iPad: tap the Share icon and choose “Add to Home Screen”.",
    loading: "Loading vocabulary …",
    loadError: "Could not load the vocabulary. Please reload the page.",
    hint: "Tip: click a symbol to choose another meaning.",
    empty: "Symbols will appear here as soon as you type.",
    detected: (l) => `Detected language: <b>${l === "de" ? "German" : "English"}</b>`,
    nSymbols: (n) => `${n} ${n === 1 ? "symbol" : "symbols"}`,
    missing: "No symbol",
    altsFor: (w) => `Meaning for “${w}”`,
    noAlt: "The BCI vocabulary has no symbol for this word. It is shown as text.",
    compound: "Compound word: Bliss starts with the classifier (the head word).",
    pos: { n: "thing", v: "action", p: "person", a: "description", o: "other", g: "interjection" },
    privacy: "This site counts visits anonymously with GoatCounter (no cookies). The text you type stays in your browser.",
    footerLicense: `Blissymbols © <a href="https://www.blissymbolics.org/" rel="noopener">Blissymbolics Communication International (BCI)</a>, vocabulary BCI-AV 2026-09-12, <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="noopener">CC BY-SA 4.0</a>. The data in <code>symbols/</code> and <code>data/</code> uses the same licence; the code is MIT (<a href="${REPO_URL}" rel="noopener">GitHub</a>).`,
    footerNote: "Unofficial helper: words are mapped one by one using the BCI vocabulary. Tense and plural indicators are placed above the first character following the BCI Fundamental Rules. For Bliss grammar and learning see blissymbolics.org.",
  },
};

const EXAMPLES = {
  de: ["Ich gehe heute mit meinem Hund in die Schule.", "Die Kinder essen gerne Äpfel und trinken Wasser.", "Morgen werde ich nach Hause gehen."],
  en: ["The children are eating food at home.", "I went to school yesterday and saw my friends.", "She will go to the big house tomorrow."],
};

const $ = (s) => document.querySelector(s);
const state = {
  ui: (navigator.language || "de").toLowerCase().startsWith("de") ? "de" : "en",
  lang: "auto",
  captions: true,
  skipArticles: true,
  grammar: true,
  size: 64,
  choices: {},
  tr: null,
  result: null,
  lay: null,
};
const PAD = 16;

// ------------------------------------------------------------ analytics (optional)
if (GOATCOUNTER) {
  const sc = document.createElement("script");
  sc.async = true;
  sc.dataset.goatcounter = `https://${GOATCOUNTER}.goatcounter.com/count`;
  sc.src = "https://gc.zgo.at/count.js";
  document.head.appendChild(sc);
  $("#privacy").hidden = false;
}
const track = (name) => window.goatcounter?.count?.({ path: name, title: name, event: true });

// ------------------------------------------------------------ i18n
function applyI18n() {
  const t = I18N[state.ui];
  document.documentElement.lang = state.ui;
  document.title = state.ui === "de" ? "Bliss-Übersetzer · Text in Blissymbole umwandeln" : "Bliss Translator · Turn text into Blissymbols";
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const v = t[el.dataset.i18n];
    if (typeof v === "string") el.textContent = v;
  }
  refreshPwaStatus();
  for (const el of document.querySelectorAll("[data-i18n-html]")) el.innerHTML = t[el.dataset.i18nHtml];
  for (const el of document.querySelectorAll("[data-i18n-ph]")) el.placeholder = t[el.dataset.i18nPh];
  for (const b of document.querySelectorAll(".ui-lang button")) b.setAttribute("aria-pressed", String(b.dataset.ui === state.ui));
  const chips = $("#example-chips");
  chips.textContent = "";
  for (const ex of [...EXAMPLES[state.ui], ...EXAMPLES[state.ui === "de" ? "en" : "de"].slice(0, 1)]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = ex.length > 38 ? ex.slice(0, 36) + "…" : ex;
    b.title = ex;
    b.addEventListener("click", () => {
      $("#text").value = ex;
      state.choices = {};
      update();
    });
    chips.appendChild(b);
  }
}

// ------------------------------------------------------------ rendering
let raf = 0;
function update() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
  syncHash();
}

function render() {
  const out = $("#out");
  const t = I18N[state.ui];
  if (!state.tr) return;
  const text = $("#text").value;
  closePop();
  if (!text.trim()) {
    out.innerHTML = `<p class="muted">${t.empty}</p>`;
    $("#status").textContent = "";
    state.result = state.lay = null;
    toggleActions(false);
    return;
  }
  const res = state.tr.translate(text, { lang: state.lang, skipArticles: state.skipArticles, grammar: state.grammar, choices: state.choices });
  const s = state.size / 128; // px per grid unit
  const avail = Math.max(240, out.clientWidth - 16 - 2 * PAD * s);
  const lay = layout(state.tr, res.tokens, { width: avail / s, captions: state.captions, lang: state.ui });
  const label = (i) => {
    const tok = res.tokens[i];
    if (tok.kind === "sym") return `${tok.surface}: ${labelFor(state.tr.S[tok.ids[tok.sel]], res.lang)}`;
    return tok.surface || "";
  };
  out.innerHTML = toSvg(lay, { pad: PAD, lang: state.ui, labels: label });
  const svg = out.querySelector("svg");
  svg.setAttribute("width", Math.ceil((lay.width + 2 * PAD) * s));
  svg.setAttribute("height", Math.ceil((lay.height + 2 * PAD) * s));
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", text);
  state.result = res;
  state.lay = lay;
  toggleActions(true);

  const words = res.tokens.filter((x) => ["sym", "cmp", "unk", "num"].includes(x.kind) && !x.symbol);
  const unknown = words.filter((x) => x.kind === "unk");
  const n = words.length - unknown.length;
  const missing = unknown.length ? ` · ${t.missing}: <b>${[...new Set(unknown.map((u) => u.surface))].map(escapeHtml).join(", ")}</b>` : "";
  $("#status").innerHTML = `${t.detected(res.lang)} · ${t.nSymbols(n)}${missing}`;
}

function toggleActions(on) {
  for (const id of ["#btn-png", "#btn-svg", "#btn-print"]) $(id).disabled = !on;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ------------------------------------------------------------ alternatives popover
function closePop() {
  $("#pop").hidden = true;
}

function openPop(rect, tok) {
  const t = I18N[state.ui];
  const pop = $("#pop");
  const S = state.tr.S;
  const lang = state.result.lang;
  pop.textContent = "";
  const h = document.createElement("h3");
  h.textContent = t.altsFor(tok.surface);
  pop.appendChild(h);
  if (tok.kind === "unk") {
    const p = document.createElement("p");
    p.textContent = t.noAlt;
    pop.appendChild(p);
  } else if (tok.kind === "cmp") {
    const p = document.createElement("p");
    p.textContent = `${t.compound} ${tok.parts.map((x) => labelFor(S[x.ids[0]], lang)).join(" + ")}`;
    pop.appendChild(p);
  } else if (tok.kind === "sym") {
    const list = document.createElement("div");
    list.className = "alts";
    tok.ids.slice(0, 12).forEach((id, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "alt";
      if (i === tok.sel) b.setAttribute("aria-current", "true");
      const img = document.createElement("img");
      img.src = `symbols/${id}.svg`;
      img.alt = "";
      img.loading = "lazy";
      const d = document.createElement("span");
      d.textContent = labelFor(S[id], lang);
      const sm = document.createElement("small");
      sm.textContent = `${t.pos[S[id][2]] || ""} · #${id}`;
      d.appendChild(sm);
      b.append(img, d);
      b.addEventListener("click", () => {
        state.choices[tok.surface.toLowerCase()] = id;
        track("choose-alternative");
        update();
      });
      list.appendChild(b);
    });
    pop.appendChild(list);
  }
  pop.hidden = false;
  const box = rect.getBoundingClientRect();
  const w = pop.offsetWidth;
  let left = box.left + window.scrollX + box.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.scrollX + document.documentElement.clientWidth - w - 8));
  pop.style.left = `${left}px`;
  pop.style.top = `${box.bottom + window.scrollY + 8}px`;
  pop.querySelector("button")?.focus({ preventScroll: true });
}

$("#out").addEventListener("click", (e) => {
  const hit = e.target.closest(".hit");
  if (!hit || !state.result) return;
  openPop(hit, state.result.tokens[Number(hit.dataset.i)]);
  e.stopPropagation();
});
$("#out").addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.classList?.contains("hit")) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#pop")) closePop();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePop();
});

// ------------------------------------------------------------ export
const symbolCache = new Map();
async function fetchSymbol(id) {
  if (!symbolCache.has(id)) {
    symbolCache.set(
      id,
      fetch(`symbols/${id}.svg`)
        .then((r) => r.text())
        .then((txt) => {
          const vb = txt.match(/viewBox="([^"]+)"/)[1];
          const inner = txt.slice(txt.indexOf(">", txt.indexOf("<svg")) + 1, txt.lastIndexOf("</svg>"));
          return { vb, inner };
        }),
    );
  }
  return symbolCache.get(id);
}

async function standaloneSvg(scale) {
  const lay = state.lay;
  const ids = [...new Set(lay.items.filter((i) => i.t === "img").map((i) => i.id))];
  const embed = new Map();
  await Promise.all(ids.map(async (id) => embed.set(id, await fetchSymbol(id))));
  const pad = 24;
  let svg = toSvg(lay, { embed, pad, background: "#ffffff", lang: state.ui });
  const w = Math.ceil((lay.width + pad * 2) * scale);
  const h = Math.ceil((lay.height + pad * 2) * scale);
  svg = svg.replace("<svg ", `<svg width="${w}" height="${h}" `);
  const credit = "<!-- Blissymbols (c) Blissymbolics Communication International (BCI), BCI-AV, CC BY-SA 4.0 - https://www.blissymbolics.org/ -->";
  return { svg: `<?xml version="1.0" encoding="UTF-8"?>\n${credit}\n${svg}`, w, h };
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

$("#btn-svg").addEventListener("click", async () => {
  if (!state.lay) return;
  const { svg } = await standaloneSvg(state.size / 128);
  download(new Blob([svg], { type: "image/svg+xml" }), "bliss.svg");
  track("export-svg");
});

$("#btn-png").addEventListener("click", async () => {
  if (!state.lay) return;
  const { svg, w, h } = await standaloneSvg(Math.max(1.5, (state.size / 128) * 2));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    c.toBlob((b) => download(b, "bliss.png"), "image/png");
    track("export-png");
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
});

$("#btn-print").addEventListener("click", () => {
  track("print");
  window.print();
});

$("#btn-link").addEventListener("click", async () => {
  syncHash(true);
  try {
    await navigator.clipboard.writeText(location.href);
    const b = $("#btn-link");
    const old = b.textContent;
    b.textContent = I18N[state.ui].linkCopied;
    setTimeout(() => (b.textContent = old), 1500);
  } catch {
    window.prompt("Link", location.href);
  }
  track("copy-link");
});

// ------------------------------------------------------------ share link (#t=...&l=...)
let hashTimer = 0;
function syncHash(now = false) {
  clearTimeout(hashTimer);
  const run = () => {
    const text = $("#text").value;
    const p = new URLSearchParams();
    if (text) p.set("t", text.slice(0, 1500));
    if (state.lang !== "auto") p.set("l", state.lang);
    history.replaceState(null, "", p.toString() ? `#${p}` : location.pathname + location.search);
  };
  if (now) run();
  else hashTimer = setTimeout(run, 400);
}

// ------------------------------------------------------------ PWA: install + offline
const SYMBOL_CACHE = "bliss-symbols-v1"; // must match sw.js
let installEvent = null;
let offlineState = { done: false, busy: false, n: 0, total: 0, failed: false };

function refreshPwaStatus() {
  const t = I18N[state.ui];
  const el = $("#pwa-status");
  if (!el) return;
  if (offlineState.busy) el.textContent = t.offlineProgress(offlineState.n, offlineState.total);
  else if (offlineState.failed) el.textContent = t.offlineFail;
  else if (offlineState.done) el.textContent = t.offlineReady;
  else el.textContent = "";
}

async function downloadAllSymbols() {
  if (offlineState.busy || !("caches" in window) || !state.tr) return;
  const ids = Object.keys(state.tr.S);
  const cache = await caches.open(SYMBOL_CACHE);
  offlineState = { done: false, busy: true, n: 0, total: ids.length, failed: false };
  $("#btn-offline").disabled = true;
  try {
    const todo = [];
    for (const id of ids) if (!(await cache.match(`symbols/${id}.svg`))) todo.push(id);
    offlineState.n = ids.length - todo.length;
    refreshPwaStatus();
    for (let i = 0; i < todo.length; i += 24) {
      await Promise.all(todo.slice(i, i + 24).map((id) => cache.add(`symbols/${id}.svg`)));
      offlineState.n = Math.min(ids.length, ids.length - todo.length + i + 24);
      refreshPwaStatus();
    }
    offlineState = { ...offlineState, busy: false, done: true, n: ids.length };
    try {
      localStorage.setItem("bliss-offline-all", "1");
    } catch {}
    navigator.storage?.persist?.();
    track("offline-all");
  } catch (err) {
    console.error(err);
    offlineState = { ...offlineState, busy: false, failed: true };
    $("#btn-offline").disabled = false;
  }
  refreshPwaStatus();
}

async function initPwa() {
  if (!("serviceWorker" in navigator) || !(location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) return;
  try {
    await navigator.serviceWorker.register("sw.js");
  } catch (err) {
    console.warn("Service worker registration failed", err);
    return;
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
    if (!standalone) $("#btn-install").hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    $("#btn-install").hidden = true;
    installEvent = null;
    track("app-installed");
  });
  $("#btn-install").addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    $("#btn-install").hidden = true;
  });
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !standalone) $("#ios-hint").hidden = false;
  $("#btn-offline").hidden = false;
  $("#btn-offline").addEventListener("click", downloadAllSymbols);
  try {
    if (localStorage.getItem("bliss-offline-all")) {
      // verify that the cache is still complete (the browser may have evicted it)
      const cache = await caches.open(SYMBOL_CACHE);
      if ((await cache.keys()).length >= 6000) {
        offlineState.done = true;
        $("#btn-offline").hidden = true;
        refreshPwaStatus();
      }
    }
  } catch {}
}

// ------------------------------------------------------------ wiring
function setLang(l) {
  state.lang = l;
  for (const b of document.querySelectorAll("#lang-seg button")) b.setAttribute("aria-checked", String(b.dataset.lang === l));
  state.choices = {};
  update();
}

async function init() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get("l") === "de" || hash.get("l") === "en") state.lang = hash.get("l");

  if (window.innerWidth < 520) state.size = 48; // smaller default on phones
  applyI18n();
  $("#size").value = state.size;
  setLang(state.lang);

  for (const b of document.querySelectorAll(".ui-lang button"))
    b.addEventListener("click", () => {
      state.ui = b.dataset.ui;
      applyI18n();
      update();
    });
  for (const b of document.querySelectorAll("#lang-seg button")) b.addEventListener("click", () => setLang(b.dataset.lang));
  $("#opt-captions").addEventListener("change", (e) => ((state.captions = e.target.checked), update()));
  $("#opt-articles").addEventListener("change", (e) => ((state.skipArticles = e.target.checked), update()));
  $("#opt-grammar").addEventListener("change", (e) => ((state.grammar = e.target.checked), update()));
  $("#size").addEventListener("input", (e) => ((state.size = Number(e.target.value)), update()));
  $("#text").addEventListener("input", update);
  let lastW = 0;
  new ResizeObserver(() => {
    const w = $("#out").clientWidth;
    if (Math.abs(w - lastW) > 4) {
      lastW = w;
      update();
    }
  }).observe($("#out"));

  try {
    const [lex, overrides] = await Promise.all([
      fetch("data/lexicon.json").then((r) => r.json()),
      fetch("data/overrides.json").then((r) => r.json()),
    ]);
    state.tr = new Translator(lex, overrides);
  } catch (err) {
    console.error(err);
    $("#out").innerHTML = `<p class="muted">${I18N[state.ui].loadError}</p>`;
    return;
  }
  $("#text").value = hash.get("t") ?? EXAMPLES[state.ui][0];
  update();
  initPwa();
}

init();
