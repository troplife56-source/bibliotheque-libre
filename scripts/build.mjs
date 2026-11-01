// scripts/build.mjs — Construit le site statique complet dans dist/
//
//   node scripts/build.mjs                  catalogue complet (Gutendex + Open Library + dépôts)
//   DEMO=1 node scripts/build.mjs           mode démo hors ligne (data/exemple-gutendex.json)
//   REFRESH=1 node scripts/build.mjs        force le re-téléchargement du catalogue
//
// Node 18+ requis, aucune dépendance.
import { mkdir, readFile, writeFile, rm, cp, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cfg from "../site/config.js";
import {
  categorize, slugify, norm, renderBookPage, headCommon, siteHeader, siteFooter,
  depotToBook, supabaseActif, CATEGORIES
} from "../site/assets/shared.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const CACHE = path.join(ROOT, "data", ".cache");
const env = process.env;
const DEMO = !!env.DEMO;
const LANGS = (env.LANGS ? env.LANGS.split(",") : cfg.catalogue.langues).map(s => s.trim());
const MAX = Number(env.MAX_PAR_LANGUE || cfg.catalogue.maxParLangue);
const ENRICH = Number(env.ENRICHIR ?? (DEMO ? 0 : cfg.catalogue.enrichir));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log("•", ...a);

async function readJSON(p, fallback) {
  try { return JSON.parse(await readFile(p, "utf8")); } catch { return fallback; }
}

async function fetchJSON(url, { tries = 4, headers = {} } = {}) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": "bibliotheque-libre-build", ...headers }, signal: AbortSignal.timeout(60_000) });
      if (r.ok) return await r.json();
      if (r.status === 404) return null;
      throw new Error(`HTTP ${r.status}`);
    } catch (e) {
      if (i === tries) throw new Error(`${url} → ${e.message}`);
      await sleep(2000 * i);
    }
  }
}

// ---------- 1. Gutendex → livres ----------
const prettyAuthor = n => (n || "Anonyme").replace(/\s*\(.*?\)\s*/g, " ").trim().split(", ").reverse().join(" ");
const cleanTitle = t => t.split(/\r?\n/)[0].replace(/\s+/g, " ").replace(/[;:,]\s*$/, "").trim();

function fromGutendex(g) {
  const f = g.formats || {};
  const html = Object.entries(f).find(([k]) => k.startsWith("text/html"))?.[1];
  const a = g.authors?.[0];
  return {
    id: `gut-${g.id}`,
    t: cleanTitle(g.title),
    a: prettyAuthor(a?.name),
    vie: a && (a.birth_year || a.death_year) ? [a.birth_year, a.death_year] : null,
    y: null,
    l: g.languages?.[0] || "fr",
    c: categorize([...(g.subjects || []), ...(g.bookshelves || [])]),
    resume: (g.summaries?.[0] || "").replace(/\s*\(This is an automatically generated summary\.\)\s*$/i, "").slice(0, 600),
    liens: {
      ...(f["application/epub+zip"] && { epub: f["application/epub+zip"] }),
      ...(html && { html }),
      source: `https://www.gutenberg.org/ebooks/${g.id}`
    },
    p: g.download_count || 0
  };
}

async function loadGutendex() {
  if (DEMO) {
    const page = await readJSON(path.join(ROOT, "data", "exemple-gutendex.json"));
    return page.results.filter(g => g.media_type === "Text").map(fromGutendex);
  }
  const file = path.join(CACHE, "gutendex.json");
  if (!env.REFRESH && existsSync(file)) {
    const age = (Date.now() - (await stat(file)).mtimeMs) / 864e5;
    if (age < cfg.catalogue.cacheJours) { log(`Catalogue en cache (${age.toFixed(1)} j)`); return readJSON(file, []); }
  }
  const books = [];
  for (const lang of LANGS) {
    let url = `https://gutendex.com/books/?languages=${lang}&copyright=false&mime_type=application%2Fepub`;
    let n = 0;
    while (url && n < MAX) {
      const data = await fetchJSON(url);
      if (!data) break;
      for (const g of data.results) if (g.media_type === "Text" && n < MAX) { books.push(fromGutendex(g)); n++; }
      log(`Gutendex [${lang}] ${n}/${Math.min(MAX, data.count)}`);
      url = data.next;
      await sleep(250);
    }
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(books));
  return books;
}

// ---------- 2. Open Library : année de première publication + ISBN ----------
async function enrich(books) {
  if (!ENRICH) return;
  const file = path.join(CACHE, "openlibrary.json");
  const cache = await readJSON(file, {});
  const cibles = [...books].sort((a, b) => b.p - a.p).slice(0, ENRICH);
  let faits = 0;
  for (const b of cibles) {
    if (!(b.id in cache)) {
      const u = `https://openlibrary.org/search.json?title=${encodeURIComponent(b.t)}&author=${encodeURIComponent(b.a)}&fields=first_publish_year,isbn&limit=1`;
      try {
        const d = await fetchJSON(u, { tries: 2 });
        const doc = d?.docs?.[0];
        const isbn = doc?.isbn?.find(i => /^97[89]\d{10}$/.test(i)) || null;
        cache[b.id] = doc ? { y: doc.first_publish_year || null, isbn } : null;
      } catch { cache[b.id] = null; }
      if (++faits % 25 === 0) { log(`Open Library ${faits}`); await writeFile(file, JSON.stringify(cache)); }
      await sleep(400);
    }
    const e = cache[b.id];
    if (e) { b.y ??= e.y; b.isbn ??= e.isbn; }
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(cache));
}

// ---------- 3. Dépôts publiés (Supabase) ----------
async function loadDepots() {
  if (!supabaseActif(cfg) || DEMO) return [];
  const url = `${cfg.supabase.url}/rest/v1/depots?status=eq.publie&select=*&order=created_at.desc`;
  try {
    const rows = await fetchJSON(url, { headers: { apikey: cfg.supabase.anonKey, Authorization: `Bearer ${cfg.supabase.anonKey}` } });
    log(`${rows?.length || 0} livre(s) déposé(s) par des auteurs`);
    return (rows || []).map(r => depotToBook(r, cfg));
  } catch (e) { console.warn("⚠ Dépôts non récupérés :", e.message); return []; }
}

// ---------- 4. Assemblage ----------
function dedupe(books) {
  // Gutenberg contient souvent plusieurs éditions d'un même titre : on garde la plus lue.
  const best = new Map();
  for (const b of books) {
    const k = b.depot ? b.id : `${norm(b.t)}|${norm(b.a)}|${b.l}`;
    if (!best.has(k) || best.get(k).p < b.p) best.set(k, b);
  }
  return [...best.values()];
}

function applyManual(books, manual) {
  const byId = new Map(books.map(b => [b.id, b]));
  for (const m of manual) {
    if (m.supprimer) { byId.delete(m.id); continue; }
    const base = byId.get(m.id) || { p: 0, c: ["classiques"], l: "fr", liens: {} };
    byId.set(m.id, { ...base, ...m, liens: { ...base.liens, ...m.liens } });
  }
  return [...byId.values()];
}

function assignSlugs(books) {
  const used = new Set();
  for (const b of books.sort((x, y) => y.p - x.p)) {
    if (b.slug && !used.has(b.slug)) { used.add(b.slug); continue; }
    const base = slugify(`${b.t} ${b.a.split(" ").pop()}`);
    let s = base, i = 2;
    while (used.has(s)) s = `${base}-${i++}`;
    b.slug = s; used.add(s);
  }
}

const lite = b => ({
  i: b.id, s: b.slug, t: b.t, a: b.a, l: b.l, c: b.c, p: b.p,
  ...(b.y && { y: b.y }), ...(b.cv && { cv: b.cv }), ...(b.depot && { d: 1, u: b.uuid })
});

async function walkHtml(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walkHtml(p));
    else if (e.name.endsWith(".html")) out.push(p);
  }
  return out;
}

// ---------- Main ----------
const t0 = Date.now();
let books = await loadGutendex();
log(`${books.length} livres récupérés`);
await enrich(books);
books = applyManual([...books, ...await loadDepots()], await readJSON(path.join(ROOT, "data", "manual.json"), []));
books = dedupe(books);
assignSlugs(books);

await rm(DIST, { recursive: true, force: true });
await cp(path.join(ROOT, "site"), DIST, { recursive: true });

// Gabarits communs injectés dans les pages fixes (<!--HEAD-->, <!--HEADER:xxx-->, <!--FOOTER-->)
// La page 404 peut s'afficher à n'importe quelle profondeur : elle utilise un chemin absolu.
const basePath = new URL(cfg.urlSite).pathname.replace(/\/?$/, "/");
for (const f of await walkHtml(DIST)) {
  const root = path.basename(f) === "404.html" ? basePath : "./";
  let html = await readFile(f, "utf8");
  html = html.replace("<!--HEAD-->", headCommon(root, cfg))
    .replace(/<!--HEADER(?::(\w+))?-->/, (_, k) => siteHeader(root, cfg, k))
    .replace("<!--FOOTER-->", siteFooter(root, cfg))
    .replaceAll("{{ROOT}}", root)
    .replaceAll("{{NOM}}", cfg.nom).replaceAll("{{SLOGAN}}", cfg.slogan)
    .replaceAll("{{CONTACT}}", cfg.contact).replaceAll("{{URL}}", cfg.urlSite);
  await writeFile(f, html);
}

// Données pour le front
await mkdir(path.join(DIST, "data"), { recursive: true });
const index = books.map(lite);
const genere = new Date().toISOString();
await writeFile(path.join(DIST, "data", "index.json"), JSON.stringify({ genere, livres: index }));
await cp(path.join(ROOT, "data", "collections.json"), path.join(DIST, "data", "collections.json"));

// Une page par livre + suggestions de la même catégorie
const parCat = {};
for (const b of index) for (const c of b.c) (parCat[c] ??= []).push(b);
for (const list of Object.values(parCat)) list.sort((x, y) => y.p - x.p);
for (const b of books) {
  // Suggestions : même langue, catégories du livre par ordre d'importance
  const sim = [];
  for (const c of b.c) for (const x of parCat[c] || []) {
    if (sim.length >= 6) break;
    if (x.i !== b.id && x.l === b.l && !sim.includes(x)) sim.push(x);
  }
  const dir = path.join(DIST, "livre", b.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderBookPage(b, cfg, sim));
}

// SEO : sitemap + robots
const urls = [`${cfg.urlSite}/`, ...books.map(b => `${cfg.urlSite}/livre/${b.slug}/`)];
await writeFile(path.join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
await writeFile(path.join(DIST, "robots.txt"),
  `User-agent: *\nDisallow: /moderation.html\nSitemap: ${cfg.urlSite}/sitemap.xml\n`);

// Récapitulatif
const stats = {};
for (const b of books) for (const c of b.c) stats[c] = (stats[c] || 0) + 1;
console.log(`\n✓ ${books.length} livres · ${Object.keys(stats).length}/${CATEGORIES.length} catégories utilisées · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const c of CATEGORIES) if (stats[c.slug]) console.log(`  ${String(stats[c.slug]).padStart(6)}  ${c.nom}`);
console.log(`\nSite prêt dans dist/ — aperçu : npm run serve`);
