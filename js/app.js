import { Translator } from "./translate.js";
import { CODES } from "./langs/index.js";
import { layout, toSvg } from "./layout.js";
import { GOATCOUNTER } from "./config.js";
import { I18N, LANG_NAMES, NATIVE, EXAMPLES, START } from "./i18n.js";

// index.html, style.css and app.js must be the same build (see tools/stamp.py). A CDN or browser
// cache can serve a mix right after a deploy; then drop the shell caches and reload once.
const BUILD = "6af9f483";
function checkBuild() {
  const html = document.querySelector('meta[name="build"]')?.content;
  const css = getComputedStyle(document.documentElement).getPropertyValue("--build").replace(/["'\s]/g, "");
  try {
    if (html === BUILD && css === BUILD) return sessionStorage.removeItem("bliss-heal");
    if (sessionStorage.getItem("bliss-heal")) return; // already tried once, avoid a reload loop
    sessionStorage.setItem("bliss-heal", "1");
  } catch {
    return;
  }
  (async () => {
    try {
      for (const k of await caches.keys()) if (k.startsWith("bliss-shell-")) await caches.delete(k);
      await Promise.all(["./", "css/style.css", import.meta.url].map((u) => fetch(u, { cache: "reload" }).catch(() => {})));
    } finally {
      location.reload();
    }
  })();
}
if (document.readyState === "complete") checkBuild();
else addEventListener("load", checkBuild, { once: true });

const $ = (s) => document.querySelector(s);

// settings are kept in the browser (never sent anywhere); the typed text is not stored
const STORE = "bliss-settings";
const readStore = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const writeStore = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};
const saved = (() => {
  try {
    return JSON.parse(readStore(STORE)) || {};
  } catch {
    return {};
  }
})();

const state = {
  // the interface speaks the chosen language; "auto" (the default) means German
  get ui() {
    return this.lang === "auto" ? "de" : this.lang;
  },
  lang: "auto",
  captions: true,
  skipArticles: false,
  grammar: false,
  size: 48,
  choices: {},
  tr: null,
  result: null,
  lay: null,
};
const PAD = 16;
const SIZES = [40, 48, 64, 80, 96, 128]; // the size slider moves in these steps
const nearestSize = (v) => SIZES.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

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
  document.title = t.docTitle;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    const v = t[el.dataset.i18n];
    if (typeof v === "string") el.textContent = v;
  }
  refreshPwaStatus();
  for (const el of document.querySelectorAll("[data-i18n-html]")) el.innerHTML = t[el.dataset.i18nHtml];
  for (const el of document.querySelectorAll("[data-i18n-ph]")) el.placeholder = t[el.dataset.i18nPh];
  applyLangLabels();
  applyChips();
  refreshShareLabel();
}

/** The language switcher: Auto plus one pill per language, each under its own name. */
function buildLangSeg() {
  const seg = $("#lang-seg");
  for (const code of ["auto", ...CODES]) {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "radio");
    b.dataset.lang = code;
    b.setAttribute("aria-checked", "false");
    if (code === "auto") b.className = "auto";
    else b.lang = code;
    b.addEventListener("click", () => (setLang(code), closeLangMenu()));
    seg.appendChild(b);
  }
  applyLangLabels();
}

function closeLangMenu() {
  $("#lang-menu").hidden = true;
  $("#lang-btn").setAttribute("aria-expanded", "false");
}
function toggleLangMenu() {
  const open = $("#lang-menu").hidden;
  $("#lang-menu").hidden = !open;
  $("#lang-btn").setAttribute("aria-expanded", String(open));
  if (open) document.querySelector('#lang-seg [aria-checked="true"]')?.focus({ preventScroll: true });
}

function applyLangLabels() {
  const auto = document.querySelector('#lang-seg [data-lang="auto"]');
  if (auto) auto.textContent = I18N[state.ui].langAuto;
  $("#lang-code").textContent = state.lang === "auto" ? I18N[state.ui].langAuto : state.lang.toUpperCase();
  $("#lang-btn").setAttribute("aria-label", `${I18N[state.ui].langLabel}: ${state.lang === "auto" ? I18N[state.ui].langAuto : NATIVE[state.lang]}`);
  for (const b of document.querySelectorAll("#lang-seg button:not(.auto)")) b.textContent = NATIVE[b.dataset.lang];
}

function applyChips() {
  const chips = $("#example-chips");
  chips.textContent = "";
  for (const ex of exampleList()) {
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

function exampleList() {
  if (state.lang !== "auto") return EXAMPLES[state.lang];
  const others = CODES.filter((c) => c !== state.ui);
  return [...EXAMPLES[state.ui], ...others.map((c) => EXAMPLES[c][0])];
}

// ------------------------------------------------------------ rendering
let raf = 0;
function update() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(render);
  syncHash();
  writeStore(STORE, JSON.stringify({ lang: state.lang, captions: state.captions, skipArticles: state.skipArticles, grammar: state.grammar, size: state.size }));
}

/** The text box grows with its content (up to ~40% of the screen). */
function autosize() {
  const ta = $("#text");
  ta.style.height = "auto";
  ta.style.height = `${Math.min(ta.scrollHeight + 2, Math.round(window.innerHeight * 0.4))}px`;
}

function render() {
  const out = $("#out");
  $("#btn-clear").hidden = !$("#text").value;
  refreshShareLabel();
  autosize();
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
  const lang = state.lang === "auto" ? state.tr.detectLang(text) : state.lang;
  if (!state.tr.has(lang)) {
    $("#status").textContent = t.loading;
    ensureLang(lang).then(update, (err) => {
      console.error(err);
      out.innerHTML = `<p class="muted">${t.loadError}</p>`;
    });
    return;
  }
  const res = state.tr.translate(text, { lang, skipArticles: state.skipArticles, grammar: state.grammar, choices: state.choices });
  const s = state.size / 128; // px per grid unit
  const avail = Math.max(240, out.clientWidth - 16 - 2 * PAD * s);
  const lay = layout(state.tr, res.tokens, { width: avail / s, captions: state.captions, lang: state.ui });
  const label = (i) => {
    const tok = res.tokens[i];
    if (tok.kind === "sym") return `${tok.surface}: ${state.tr.label(tok.ids[tok.sel], res.lang)}`;
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
  $("#status").innerHTML = `${t.detected(res.lang, state.lang === "auto")} · ${t.nSymbols(n)}${missing}`;
}

function toggleActions(on) {
  for (const id of ["#btn-png", "#btn-print"]) $(id).disabled = !on;
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ------------------------------------------------------------ language data (loaded on demand)
const langLoads = {};
function ensureLang(code) {
  if (state.tr.has(code)) return Promise.resolve();
  langLoads[code] ||= fetch(`data/lang/${code}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`data/lang/${code}.json: ${r.status}`);
      return r.json();
    })
    .then((d) => state.tr.addLanguage(code, d))
    .catch((err) => {
      delete langLoads[code];
      throw err;
    });
  return langLoads[code];
}

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
    p.textContent = `${t.compound} ${tok.parts.map((x) => state.tr.label(x.ids[0], lang)).join(" + ")}`;
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
      d.textContent = state.tr.label(id, lang);
      const sm = document.createElement("small");
      sm.textContent = `${t.pos[S[id][1]] || ""} · #${id}`;
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

/** Render the current result to a PNG blob (white background). */
async function renderPng() {
  const scale = Math.max(1.5, (state.size / 128) * 2);
  const { svg, w, h } = await standaloneSvg(scale);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  // a small credit line (CC BY-SA 4.0 attribution) under the symbols
  const fs = Math.round(7 * scale);
  const band = Math.round(fs * 2.2);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h + band;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h + band);
  ctx.drawImage(img, 0, 0, w, h);
  ctx.fillStyle = "#8a8478";
  ctx.font = `${fs}px system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("Blissymbols © BCI · CC BY-SA 4.0 · blissymbolics.org", w - fs, h + band / 2);
  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

$("#btn-png").addEventListener("click", async () => {
  if (!state.lay) return;
  download(await renderPng(), "bliss.png");
  track("export-png");
});

$("#btn-print").addEventListener("click", () => {
  track("print");
  window.print();
});

// "Share app" (empty box) / "Share text" (with text): system share sheet on touch devices, otherwise copy the link
function refreshShareLabel() {
  const t = I18N[state.ui];
  $("#share-label").textContent = $("#text").value.trim() ? t.btnLinkText : t.btnLinkApp;
}
$("#btn-link").addEventListener("click", async () => {
  const hasText = !!$("#text").value.trim();
  let url;
  if (hasText) {
    syncHash(true);
    url = location.href;
  } else {
    url = location.href.split("#")[0];
  }
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: I18N[state.ui].title, url });
      track(hasText ? "share-text" : "share-app");
      return;
    } catch (err) {
      if (err?.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    $("#share-label").textContent = I18N[state.ui].linkCopied;
    setTimeout(refreshShareLabel, 1500);
  } catch {
    window.prompt("Link", url);
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
    await Promise.all(CODES.map((c) => fetch(`data/lang/${c}.json`))); // the service worker keeps them
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
  // an untouched start sentence follows the language
  const box = $("#text");
  if (Object.values(START).includes(box.value)) box.value = START[l === "auto" ? "de" : l];
  applyI18n();
  for (const b of document.querySelectorAll("#lang-seg button")) b.setAttribute("aria-checked", String(b.dataset.lang === l));
  $("#lang-code").textContent = l === "auto" ? I18N[state.ui].langAuto : l.toUpperCase();
  applyChips();
  state.choices = {};
  update();
}

async function init() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (typeof saved.captions === "boolean") state.captions = saved.captions;
  if (typeof saved.skipArticles === "boolean") state.skipArticles = saved.skipArticles;
  if (typeof saved.grammar === "boolean") state.grammar = saved.grammar;
  if (saved.lang === "auto" || CODES.includes(saved.lang)) state.lang = saved.lang;
  if (CODES.includes(hash.get("l"))) state.lang = hash.get("l"); // a shared link wins
  if (saved.size >= 40 && saved.size <= 140) state.size = nearestSize(saved.size);
  $("#opt-captions").checked = state.captions;
  $("#opt-articles").checked = state.skipArticles;
  $("#opt-grammar").checked = state.grammar;
  if (window.innerWidth < 720) $("#opts").open = false; // the result comes first on phones
  buildLangSeg();
  applyI18n();
  $("#size").value = SIZES.indexOf(state.size);
  setLang(state.lang);

  $("#lang-btn").addEventListener("click", toggleLangMenu);
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".langmenu")) closeLangMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#lang-menu").hidden) (closeLangMenu(), $("#lang-btn").focus());
  });
  $("#btn-clear").addEventListener("click", () => {
    $("#text").value = "";
    state.choices = {};
    $("#text").focus();
    update();
  });
  $("#opt-captions").addEventListener("change", (e) => ((state.captions = e.target.checked), update()));
  $("#opt-articles").addEventListener("change", (e) => ((state.skipArticles = e.target.checked), update()));
  $("#opt-grammar").addEventListener("change", (e) => ((state.grammar = e.target.checked), update()));
  // applied on release only (change), so a stray touch while scrolling cannot resize everything
  $("#size").addEventListener("change", (e) => ((state.size = SIZES[Number(e.target.value)] ?? 48), update()));
  $("#text").addEventListener("input", update);
  // hide the bottom tab bar only while the on-screen keyboard is really open
  let baseH = window.innerHeight;
  const syncKeyboard = () => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    if (h > baseH) baseH = h;
    document.body.classList.toggle("typing", document.activeElement === $("#text") && h < baseH * 0.8);
  };
  window.visualViewport?.addEventListener("resize", syncKeyboard);
  window.addEventListener("resize", syncKeyboard);
  window.addEventListener("orientationchange", () => setTimeout(() => ((baseH = window.innerHeight), syncKeyboard()), 400));
  $("#text").addEventListener("focus", () => setTimeout(syncKeyboard, 300));
  $("#text").addEventListener("blur", syncKeyboard);
  let lastW = 0;
  new ResizeObserver(() => {
    const w = $("#out").clientWidth;
    if (Math.abs(w - lastW) > 4) {
      lastW = w;
      update();
    }
  }).observe($("#out"));

  try {
    const [symbols, overrides] = await Promise.all([
      fetch("data/symbols.json").then((r) => r.json()),
      fetch("data/overrides.json").then((r) => r.json()),
    ]);
    state.tr = new Translator(symbols, overrides);
    await Promise.all(["de", "en", state.lang].filter((c, i, a) => c !== "auto" && a.indexOf(c) === i).map(ensureLang));
  } catch (err) {
    console.error(err);
    $("#out").innerHTML = `<p class="muted">${I18N[state.ui].loadError}</p>`;
    return;
  }
  $("#text").value = hash.get("t") ?? START[state.lang === "auto" ? "de" : state.lang];
  update();
  initPwa();
}

init();
