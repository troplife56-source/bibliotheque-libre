// Catalogue : chargement, recherche instantanée, filtres, collections, pagination.
import cfg from "../config.js";
import { CATEGORIES, CAT_BY_SLUG, LANGUES, norm, cardHTML, supabaseActif, depotToBook } from "./shared.js";

const $ = s => document.querySelector(s);
const PAGE = 48;
const state = { q: "", cat: "", lang: "", sort: "pertinence", col: "" };
let BOOKS = [], COLS = [], shown = PAGE, lastList = [], lastTokens = [];

// ---------- Chargement ----------
async function load() {
  const [idx, cols] = await Promise.all([
    fetch("data/index.json").then(r => r.json()),
    fetch("data/collections.json").then(r => r.json()).catch(() => [])
  ]);
  BOOKS = idx.livres.map(prep);
  COLS = cols;
  if (supabaseActif(cfg)) addLiveDepots(); // en arrière-plan : n'empêche pas l'affichage
}

// Index de recherche pré-calculé une seule fois
function prep(b) {
  b._t = norm(b.t); b._a = norm(b.a);
  b._all = `${b._t} ${b._a} ${b.c.map(c => norm(CAT_BY_SLUG[c]?.nom)).join(" ")} ${b.y || ""}`;
  return b;
}

// Livres validés depuis le dernier build : affichés tout de suite, sans attendre le prochain build
async function addLiveDepots() {
  try {
    const { supa } = await import("./supa.js");
    const { data, error } = await (await supa()).from("depots").select("*").eq("status", "publie");
    if (error) throw error;
    const known = new Set(BOOKS.map(b => b.i));
    const nouveaux = data.filter(r => !known.has(`dep-${r.id}`)).map(r => {
      const b = depotToBook(r, cfg);
      return prep({ i: b.id, t: b.t, a: b.a, l: b.l, c: b.c, p: 0, y: b.y, cv: b.cv, d: 1, uuid: r.id, live: true });
    });
    if (nouveaux.length) { BOOKS.push(...nouveaux); buildCollections(); render(); }
  } catch (e) { console.warn("Dépôts indisponibles", e); }
}

// ---------- Recherche ----------
function score(b, tokens) {
  let s = 0;
  for (const t of tokens) {
    if (!b._all.includes(t)) return -1;          // tous les mots doivent être présents
    if (b._t.startsWith(t)) s += 8;
    else if (b._t.includes(" " + t)) s += 5;
    else if (b._t.includes(t)) s += 3;
    if (b._a.includes(t)) s += 4;
    s += 1;
  }
  return s + Math.log10(1 + b.p) / 2;              // départage par popularité
}

function collectionMembers(col) {
  if (col.ids) {
    const pos = new Map(col.ids.map((id, i) => [id, i]));
    return BOOKS.filter(b => pos.has(b.i)).sort((x, y) => pos.get(x.i) - pos.get(y.i));
  }
  const f = col.filtre || {};
  let list = BOOKS.filter(b => (!f.langue || b.l === f.langue) && (!f.categorie || b.c.includes(f.categorie)) && (!f.depot || b.d));
  if (col.tri === "popularite" || col.limite) list = [...list].sort((x, y) => y.p - x.p);
  return col.limite ? list.slice(0, col.limite) : list;
}

function compute() {
  const tokens = norm(state.q).split(/\s+/).filter(Boolean);
  const col = COLS.find(c => c.slug === state.col);
  let base = col ? collectionMembers(col) : BOOKS;
  let list = base.filter(b => (!state.cat || b.c.includes(state.cat)) && (!state.lang || b.l === state.lang));
  if (tokens.length) {
    list = list.map(b => [b, score(b, tokens)]).filter(x => x[1] >= 0);
    if (state.sort === "pertinence") list.sort((x, y) => y[1] - x[1]);
    list = list.map(x => x[0]);
  } else if (state.sort === "pertinence" && !col?.ids) {
    list = [...list].sort((x, y) => y.p - x.p);
  }
  if (state.sort === "titre") list = [...list].sort((x, y) => x.t.localeCompare(y.t, "fr"));
  if (state.sort === "auteur") list = [...list].sort((x, y) => x.a.split(" ").pop().localeCompare(y.a.split(" ").pop(), "fr"));
  if (state.sort === "annee") list = [...list].sort((x, y) => (x.y ?? 9999) - (y.y ?? 9999));
  return { list, tokens, col };
}

// ---------- Affichage ----------
function highlight(el, tokens) {
  const text = el.textContent, n = norm(text);
  if (n.length !== text.length) return;           // sécurité : caractères décomposés
  const ranges = [];
  for (const t of tokens) for (let i = n.indexOf(t); i > -1; i = n.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
  if (!ranges.length) return;
  ranges.sort((a, b) => a[0] - b[0]);
  el.textContent = "";
  let pos = 0;
  for (const [a, b] of ranges) {
    if (a < pos) continue;
    el.append(text.slice(pos, a));
    const m = document.createElement("mark"); m.textContent = text.slice(a, b); el.append(m);
    pos = b;
  }
  el.append(text.slice(pos));
}

function appendCards(from, to) {
  const grid = $("#grid");
  const start = grid.children.length;
  grid.insertAdjacentHTML("beforeend", lastList.slice(from, to).map(b => cardHTML(b, "./")).join(""));
  if (lastTokens.length) for (const li of [...grid.children].slice(start))
    li.querySelectorAll(".card-title, .card-sub").forEach(el => highlight(el, lastTokens));
  $("#more").hidden = to >= lastList.length;
}

function render() {
  const { list, tokens, col } = compute();
  lastList = list; lastTokens = tokens; shown = PAGE;
  $("#grid").replaceChildren();
  appendCards(0, shown);
  $("#empty").hidden = list.length > 0;
  $("#count").textContent = `${list.length.toLocaleString("fr-FR")} livre${list.length > 1 ? "s" : ""}`;
  $("#reset").hidden = !(state.q || state.cat || state.lang || state.col);
  const ac = $("#active-col");
  ac.hidden = !col;
  if (col) ac.textContent = `Collection : ${col.titre} — ${col.description || ""}`;
  document.querySelectorAll(".col-card").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.col === state.col)));
  syncURL();
}

function more() {
  const from = shown; shown += PAGE;
  appendCards(from, shown);
}

// ---------- Filtres & collections ----------
function buildFilters() {
  const counts = {}, langs = {};
  for (const b of BOOKS) { for (const c of b.c) counts[c] = (counts[c] || 0) + 1; langs[b.l] = (langs[b.l] || 0) + 1; }
  for (const c of CATEGORIES) if (counts[c.slug]) $("#cat").add(new Option(`${c.nom} (${counts[c.slug]})`, c.slug));
  for (const [l, n] of Object.entries(langs).sort((a, b) => b[1] - a[1])) $("#lang").add(new Option(`${LANGUES[l] || l} (${n})`, l));
  $("#stats").textContent = `${BOOKS.length.toLocaleString("fr-FR")} livres gratuits · ${Object.keys(counts).length} catégories · ${Object.keys(langs).length} langue${Object.keys(langs).length > 1 ? "s" : ""}`;
}

function buildCollections() {
  const row = $("#col-row");
  row.replaceChildren();
  for (const col of COLS) {
    const n = collectionMembers(col).length;
    if (!n) continue;
    const b = document.createElement("button");
    b.type = "button"; b.className = "col-card"; b.dataset.col = col.slug;
    b.setAttribute("aria-pressed", String(state.col === col.slug));
    const t = document.createElement("strong"); t.textContent = col.titre;
    const d = document.createElement("span"); d.textContent = `${n} livre${n > 1 ? "s" : ""}`;
    b.append(t, d);
    b.addEventListener("click", () => {
      state.col = state.col === col.slug ? "" : col.slug;
      render();
      $("#catalogue").scrollIntoView({ behavior: "smooth" });
    });
    row.append(b);
  }
  $("#collections").hidden = !row.children.length;
}

// ---------- URL partageable ----------
function syncURL() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v && !(k === "sort" && v === "pertinence")) p.set(k, v);
  const qs = p.toString();
  history.replaceState(null, "", (qs ? "?" + qs : location.pathname) + location.hash);
}
function readURL() {
  const p = new URLSearchParams(location.search);
  for (const k of Object.keys(state)) if (p.has(k)) state[k] = p.get(k);
}

const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- Démarrage ----------
readURL();
try {
  await load();
} catch (e) {
  $("#empty").hidden = false;
  $("#empty").textContent = "Le catalogue n'a pas pu être chargé. Vérifiez votre connexion puis rechargez la page.";
  throw e;
}
buildFilters();
buildCollections();
$("#q").value = state.q; $("#cat").value = state.cat; $("#lang").value = state.lang; $("#sort").value = state.sort;

$("#q").addEventListener("input", debounce(e => { state.q = e.target.value; render(); }, 120));
$("#cat").addEventListener("change", e => { state.cat = e.target.value; render(); });
$("#lang").addEventListener("change", e => { state.lang = e.target.value; render(); });
$("#sort").addEventListener("change", e => { state.sort = e.target.value; render(); });
$("#reset").addEventListener("click", () => {
  Object.assign(state, { q: "", cat: "", lang: "", col: "" });
  $("#q").value = ""; $("#cat").value = ""; $("#lang").value = "";
  render();
});
$("#more").addEventListener("click", more);
new IntersectionObserver(es => { if (es[0].isIntersecting && !$("#more").hidden) more(); }, { rootMargin: "600px" }).observe($(".more"));
document.addEventListener("keydown", e => {
  if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $("#q").focus(); }
});
render();
