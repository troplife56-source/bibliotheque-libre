// Liseuse EPUB en ligne (epub.js). Mémorise la page et la taille du texte.
import cfg from "../config.js";
const $ = s => document.querySelector(s);
const p = new URLSearchParams(location.search);
const src = p.get("src") || "";
const html = p.get("html") || "";
const titre = p.get("titre") || "Livre";

// Seules ces sources peuvent être ouvertes (évite d'afficher n'importe quel fichier via un lien piégé)
const HOTES = ["www.gutenberg.org", "gutenberg.org", "archive.org", location.hostname,
  cfg.supabase?.url ? new URL(cfg.supabase.url).hostname : ""].filter(Boolean);
const autorise = u => { try { const h = new URL(u, location.href).hostname; return HOTES.some(x => h === x || h.endsWith("." + x)); } catch { return false; } };

const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};

$("#titre").textContent = titre;
document.title = `${titre} | Liseuse`;
if (document.referrer && new URL(document.referrer).origin === location.origin) $("#back").href = document.referrer;

function echec(raison) {
  const box = $("#msg");
  box.replaceChildren();
  const t = document.createElement("p");
  t.textContent = raison;
  box.append(t);
  const actions = document.createElement("div");
  actions.className = "actions"; actions.style.justifyContent = "center";
  if (autorise(src)) { const a = Object.assign(document.createElement("a"), { className: "btn", href: src, textContent: "Télécharger l'EPUB" }); actions.append(a); }
  if (html && autorise(html)) { const a = Object.assign(document.createElement("a"), { className: "btn btn-2", href: html, textContent: "Lire la version HTML", target: "_blank", rel: "noopener" }); actions.append(a); }
  box.append(actions);
  $("#toc").hidden = true;
}

if (!src || !autorise(src)) {
  echec("Ce livre ne peut pas être ouvert dans la liseuse.");
} else if (/\.pdf($|\?)/i.test(src)) {
  location.replace(src); // le navigateur lit les PDF nativement
} else {
  ouvrir().catch(() => echec("La source n'autorise pas la lecture directe sur ce site. Vous pouvez télécharger le livre ou lire sa version HTML."));
}

async function ouvrir() {
  const key = "lire:" + src;
  const book = ePub(src, { openAs: "epub" });
  await Promise.race([book.ready, new Promise((_, rej) => setTimeout(() => rej(new Error("délai")), 25000))]);
  $("#msg").remove();

  const rendition = book.renderTo("viewer", { width: "100%", height: "100%", spread: "none", flow: "paginated" });
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  rendition.themes.register("sombre", { body: { background: "#161412 !important", color: "#efe9e1 !important" }, a: { color: "#e39a6c !important" } });
  if (dark) rendition.themes.select("sombre");
  let taille = Number(store.get("lire:taille")) || 100;
  rendition.themes.fontSize(taille + "%");
  await rendition.display(store.get(key) || undefined);

  const nav = await book.loaded.navigation;
  const toc = $("#toc");
  const ajout = (items, niveau = 0) => items.forEach(i => {
    toc.add(new Option("  ".repeat(niveau) + i.label.trim(), i.href));
    if (i.subitems?.length) ajout(i.subitems, niveau + 1);
  });
  ajout(nav.toc);
  toc.addEventListener("change", () => rendition.display(toc.value));

  book.locations.generate(1600).then(() => maj(rendition.currentLocation()));
  const maj = loc => {
    if (!loc?.start) return;
    store.set(key, loc.start.cfi);
    const pct = book.locations.length() ? Math.round(book.locations.percentageFromCfi(loc.start.cfi) * 100) : null;
    $("#pos").textContent = pct != null ? `${pct} %` : "";
  };
  rendition.on("relocated", maj);

  $("#prev").onclick = () => rendition.prev();
  $("#next").onclick = () => rendition.next();
  const zoom = d => { taille = Math.min(200, Math.max(70, taille + d)); rendition.themes.fontSize(taille + "%"); store.set("lire:taille", taille); };
  $("#smaller").onclick = () => zoom(-10);
  $("#bigger").onclick = () => zoom(10);
  const clavier = e => { if (e.key === "ArrowLeft") rendition.prev(); if (e.key === "ArrowRight") rendition.next(); };
  document.addEventListener("keyup", clavier);
  rendition.on("keyup", clavier);
}
