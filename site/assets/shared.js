// Module partagé : utilisé par le navigateur ET par scripts/build.mjs (Node).
// Aucune dépendance, aucun accès au DOM ici.

// ---------- 22 catégories ----------
// L'ordre compte : les genres précis passent avant les catégories larges.
// Chaque règle est testée sur les "subjects" et "bookshelves" de Gutenberg.
export const CATEGORIES = [
  { slug: "policier",    nom: "Policier & Mystère",            re: /detective|mystery|crime|policier|murder|sherlock/i },
  { slug: "sf",          nom: "Science-fiction & Fantastique", re: /science fiction|fantasy|fantastique|imaginary voyages|time travel|utopia/i },
  { slug: "horreur",     nom: "Horreur & Gothique",            re: /horror|gothic|ghost|vampire|supernatural|épouvante/i },
  { slug: "aventure",    nom: "Aventure",                      re: /adventure|aventure|sea stories|pirates|western stories|robinsonades/i },
  { slug: "romance",     nom: "Romance",                       re: /love stories|romance|courtship/i },
  { slug: "historique",  nom: "Roman historique",              re: /historical fiction/i },
  { slug: "nouvelles",   nom: "Nouvelles",                     re: /short stories|nouvelles/i },
  { slug: "contes",      nom: "Contes, fables & mythes",       re: /fairy tales|fables|folklore|legends|mythology|contes/i },
  { slug: "jeunesse",    nom: "Jeunesse",                      re: /children|juvenile/i },
  { slug: "humour",      nom: "Humour & Satire",               re: /humor|humour|satire/i },
  { slug: "poesie",      nom: "Poésie",                        re: /poetry|poésie|poems|sonnets|\bverse\b/i },
  { slug: "theatre",     nom: "Théâtre",                       re: /drama|comedies|tragedies|\bplays\b|théâtre/i },
  { slug: "philosophie", nom: "Philosophie",                   re: /philosophy|philosophie|ethics/i },
  { slug: "religion",    nom: "Religion & Spiritualité",       re: /religion|bible|christian|spiritual|theology|islam|buddhis/i },
  { slug: "histoire",    nom: "Histoire",                      re: /history|histoire|\bwars?\b|revolution/i },
  { slug: "biographie",  nom: "Biographies & Mémoires",        re: /biography|autobiography|memoirs|mémoires/i },
  { slug: "voyages",     nom: "Voyages & Exploration",         re: /description and travel|travel|voyages|exploration/i },
  { slug: "sciences",    nom: "Sciences & Nature",             re: /^(?!.*fiction).*(science|natural history|mathematics|astronomy|biology|physics|medicine|botany|zoology)/i },
  { slug: "essais",      nom: "Essais & Société",              re: /political|politics|economics|social|essays|sociology|education|\blaw\b/i },
  { slug: "lettres",     nom: "Correspondance",                re: /correspondence|letters/i },
  { slug: "roman",       nom: "Roman",                         re: /fiction|\bnovels?\b/i },
  { slug: "classiques",  nom: "Littérature classique",         re: null } // repli
];
export const CAT_BY_SLUG = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

/** Renvoie jusqu'à 3 slugs de catégories à partir d'une liste de sujets. */
export function categorize(subjects = []) {
  const out = [];
  for (const c of CATEGORIES) {
    if (!c.re) continue;
    if (subjects.some(s => c.re.test(s))) out.push(c.slug);
    if (out.length === 3) break;
  }
  return out.length ? out : ["classiques"];
}

export const LANGUES = {
  fr: "Français", en: "English", es: "Español", de: "Deutsch", it: "Italiano",
  pt: "Português", nl: "Nederlands", la: "Latin", ar: "العربية"
};

export const LICENCES = {
  "domaine-public": { nom: "Domaine public", url: "https://creativecommons.org/publicdomain/mark/1.0/deed.fr" },
  "cc0":            { nom: "CC0 (aucun droit réservé)", url: "https://creativecommons.org/publicdomain/zero/1.0/deed.fr" },
  "cc-by":          { nom: "CC BY", url: "https://creativecommons.org/licenses/by/4.0/deed.fr" },
  "cc-by-sa":       { nom: "CC BY-SA", url: "https://creativecommons.org/licenses/by-sa/4.0/deed.fr" },
  "cc-by-nc":       { nom: "CC BY-NC", url: "https://creativecommons.org/licenses/by-nc/4.0/deed.fr" },
  "cc-by-nc-nd":    { nom: "CC BY-NC-ND", url: "https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr" },
  "lecture-libre":  { nom: "Tous droits réservés — lecture gratuite autorisée", url: null }
};

// ---------- Utilitaires ----------
export const norm = s => (s ?? "").toString().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export const slugify = s => norm(s).replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "") || "livre";

export const esc = s => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** URL de couverture : celle du livre, sinon celle de Gutenberg déduite de l'id. */
export function coverUrl(b) {
  if (b.cv) return b.cv;
  const m = /^gut-(\d+)$/.exec(b.id || b.i || "");
  return m ? `https://www.gutenberg.org/cache/epub/${m[1]}/pg${m[1]}.cover.medium.jpg` : "";
}

/** Couverture de secours en SVG (titre + auteur sur fond coloré). */
export function fallbackCover(titre = "", auteur = "") {
  const hue = [...titre].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 20);
  const lines = wrap(titre, 18).slice(0, 4);
  const t = lines.map((l, i) => `<text x="100" y="${120 + i * 22}" font-size="17">${esc(l)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="hsl(${hue} 45% 32%)"/><rect x="12" y="12" width="176" height="276" fill="none" stroke="rgba(255,255,255,.35)"/><g fill="#fff" font-family="Georgia,serif" text-anchor="middle">${t}</g><text x="100" y="250" fill="rgba(255,255,255,.8)" font-family="Georgia,serif" font-size="12" text-anchor="middle">${esc(auteur.slice(0, 28))}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function wrap(s, n) {
  const out = []; let cur = "";
  for (const w of s.split(/\s+/)) {
    if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

/** Programmes d'affiliation configurés et actifs. */
export function affiliatesActifs(cfg) {
  return (cfg.affiliation?.programmes || []).filter(p => p.actif && !/VOTRE[_-]|ID_MARCHAND/.test(p.modele));
}

/** Liens d'achat affiliés pour un livre (éditions papier / commentées). */
export function affiliateLinks(book, cfg) {
  const q = book.isbn || `${book.t} ${book.a}`;
  const enc = encodeURIComponent(q);
  return affiliatesActifs(cfg).map(p => {
    const cible = p.cible ? p.cible.replaceAll("{q}", enc) : "";
    return { nom: p.nom, href: p.modele.replaceAll("{q}", enc).replaceAll("{url}", encodeURIComponent(cible)) };
  });
}

export const supabaseActif = cfg => !!(cfg.supabase?.url && cfg.supabase?.anonKey);

export const publicFileUrl = (cfg, bucket, path) =>
  path ? `${cfg.supabase.url}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}` : "";

/** Transforme une ligne Supabase "depots" en livre du catalogue. */
export function depotToBook(r, cfg) {
  return {
    id: `dep-${r.id}`, uuid: r.id, slug: `${slugify(r.titre + " " + r.auteur)}-${r.id.slice(0, 6)}`,
    t: r.titre, a: r.auteur, y: r.annee || null, l: r.langue, c: [r.categorie],
    resume: r.description || "", cv: publicFileUrl(cfg, "couvertures", r.couverture_path),
    liens: { [r.format]: publicFileUrl(cfg, "livres", r.fichier_path) },
    licence: r.licence, depot: true, p: 0
  };
}

// ---------- Gabarits HTML communs (pages générées et pages fixes) ----------
export function headCommon(root, cfg) {
  return `<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#8a3b12">
<link rel="icon" href="${root}icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}icon-192.png">
<link rel="manifest" href="${root}manifest.webmanifest">
<link rel="stylesheet" href="${root}assets/style.css">
<link rel="preconnect" href="https://www.gutenberg.org">${cfg.analytics?.goatcounter ? `
<script data-goatcounter="https://${esc(cfg.analytics.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ""}`;
}

export function siteHeader(root, cfg, actif = "") {
  const a = k => (k === actif ? ' aria-current="page"' : "");
  return `<a class="skip" href="#contenu">Aller au contenu</a>
<header class="site-header"><div class="wrap">
  <a class="logo" href="${root}"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5a1.5 1.5 0 0 0 0 3H20v0H6.5A2.5 2.5 0 0 1 4 19.5z"/></svg>${esc(cfg.nom)}</a>
  <nav aria-label="Navigation principale">
    <a href="${root}"${a("catalogue")}>Catalogue</a>
    <a href="${root}#collections"${a("collections")}>Collections</a>${supabaseActif(cfg) ? `
    <a href="${root}deposer.html"${a("deposer")}>Déposer un livre</a>` : ""}
  </nav>
</div></header>`;
}

export function siteFooter(root, cfg) {
  const nl = cfg.newsletter?.buttondown ? `
  <form class="newsletter" action="https://buttondown.com/api/emails/embed-subscribe/${esc(cfg.newsletter.buttondown)}" method="post" target="_blank">
    <label for="nl-email"><strong>Un classique par semaine</strong> dans votre boîte mail</label>
    <div><input id="nl-email" type="email" name="email" placeholder="votre@email.fr" required><button>S'abonner</button></div>
  </form>` : "";
  return `<footer class="site-footer"><div class="wrap">${nl}
  <p>${esc(cfg.nom)} référence des œuvres du domaine public hébergées par Project Gutenberg, Gallica et Internet Archive, ainsi que des livres déposés par leurs auteurs.</p>
  ${affiliatesActifs(cfg).length ? `<p class="small">Certains liens d'achat sont des liens affiliés : le site perçoit une petite commission, sans surcoût pour vous.</p>` : ""}
  <p class="small"><a href="${root}mentions.html">Mentions légales & confidentialité</a> · <a href="${root}mentions.html#droits">Signaler un contenu</a></p>
</div></footer>
<script type="module" src="${root}assets/common.js"></script>`;
}

/** Corps de la fiche d'un livre (utilisé par le build ET par livre.html). */
export function renderBookMain(b, cfg, root, similaires = []) {
  const cats = (b.c || []).map(s => CAT_BY_SLUG[s]).filter(Boolean);
  const lang = LANGUES[b.l] || b.l;
  const cover = coverUrl(b);
  const fb = fallbackCover(b.t, b.a);
  const vie = b.vie && (b.vie[0] || b.vie[1]) ? ` (${b.vie[0] ?? "?"}–${b.vie[1] ?? "?"})` : "";
  const resume = b.resume ||
    `${b.t}${b.y ? `, publié en ${b.y},` : ""} est une œuvre de ${b.a} disponible gratuitement${b.depot ? "" : " car elle appartient au domaine public"}. Téléchargez-la au format EPUB pour votre liseuse ou lisez-la directement en ligne.`;
  const L = b.liens || {};
  const lire = L.epub ? `${root}lire.html?src=${encodeURIComponent(L.epub)}&titre=${encodeURIComponent(b.t)}${L.html ? `&html=${encodeURIComponent(L.html)}` : ""}` : (L.pdf || L.html || "");
  const boutons = [
    lire && `<a class="btn" href="${esc(lire)}"${L.epub ? "" : ' target="_blank" rel="noopener"'}>Lire en ligne</a>`,
    L.epub && `<a class="btn btn-2" href="${esc(L.epub)}" rel="noopener" download>Télécharger l'EPUB</a>`,
    L.pdf && `<a class="btn btn-2" href="${esc(L.pdf)}" rel="noopener" target="_blank">Télécharger le PDF</a>`,
    L.html && L.epub && `<a class="btn btn-3" href="${esc(L.html)}" rel="noopener" target="_blank">Version HTML</a>`,
    L.source && `<a class="btn btn-3" href="${esc(L.source)}" rel="noopener" target="_blank">Page source</a>`
  ].filter(Boolean).join("\n      ");

  const lic = b.licence && LICENCES[b.licence];
  const licence = b.depot
    ? `<p class="licence">Déposé par son auteur · Licence : ${lic?.url ? `<a href="${lic.url}" rel="license noopener" target="_blank">${esc(lic.nom)}</a>` : esc(lic?.nom || b.licence)}</p>
      <button class="link-btn" type="button" data-signaler="${esc(b.uuid)}">Signaler ce livre</button>`
    : `<p class="licence">Œuvre du <a href="${LICENCES["domaine-public"].url}" rel="license noopener" target="_blank">domaine public</a>${b.id?.startsWith("gut-") ? " · Source : Project Gutenberg" : ""}</p>`;

  const aff = b.depot ? [] : affiliateLinks(b, cfg);
  const achat = aff.length ? `
    <section class="buy" aria-labelledby="achat">
      <h2 id="achat">Éditions papier et commentées</h2>
      <div class="actions">${aff.map(x => `<a class="btn btn-2" href="${esc(x.href)}" rel="sponsored noopener" target="_blank">${esc(x.nom)}</a>`).join("")}</div>
      <p class="small">Liens affiliés : si vous achetez, le site reçoit une petite commission, sans surcoût pour vous.</p>
    </section>` : "";

  const sim = similaires.length ? `
  <section class="similar" aria-labelledby="sim"><h2 id="sim">Dans la même catégorie</h2>
    <ul class="grid grid-sm">${similaires.map(s => cardHTML(s, root)).join("")}</ul>
  </section>` : "";

  return `<article class="book">
    <img class="book-cover" src="${esc(cover || fb)}" data-fallback="${esc(fb)}" alt="Couverture de ${esc(b.t)}" width="300" height="450">
    <div class="book-info">
      <p class="crumbs"><a href="${root}">Catalogue</a>${cats[0] ? ` › <a href="${root}?cat=${cats[0].slug}">${esc(cats[0].nom)}</a>` : ""}</p>
      <h1>${esc(b.t)}</h1>
      <p class="author">${esc(b.a)}${esc(vie)}${b.y ? ` · ${esc(b.y)}` : ""}</p>
      <div class="tags"><span class="tag">${esc(lang)}</span>${cats.map(c => `<a class="tag" href="${root}?cat=${c.slug}">${esc(c.nom)}</a>`).join("")}${b.depot ? '<span class="tag tag-indie">Auteur indépendant</span>' : ""}</div>
      <p class="resume">${esc(resume)}</p>
      <div class="actions">
      ${boutons}
      </div>
      ${licence}${achat}
    </div>
  </article>${sim}`;
}

/** Carte de livre (grille). Données au format "index léger". */
export function cardHTML(b, root) {
  const href = b.live ? `${root}livre.html?depot=${encodeURIComponent(b.uuid)}` : `${root}livre/${b.s || b.slug}/`;
  const fb = fallbackCover(b.t, b.a);
  return `<li class="card"><a href="${esc(href)}">
    <img class="cover" src="${esc(coverUrl(b) || fb)}" data-fallback="${esc(fb)}" alt="" loading="lazy" decoding="async" width="200" height="300">
    <span class="meta"><span class="card-title">${esc(b.t)}</span><span class="card-sub">${esc(b.a)}${b.y ? " · " + esc(b.y) : ""}</span></span>
  </a></li>`;
}

/** Page HTML complète d'un livre (générée au build). */
export function renderBookPage(b, cfg, similaires) {
  const root = "../../";
  const url = `${cfg.urlSite}/livre/${b.slug}/`;
  const desc = (b.resume || `${b.t} de ${b.a} : à lire et télécharger gratuitement en EPUB.`).slice(0, 160);
  const ld = {
    "@context": "https://schema.org", "@type": "Book", name: b.t, url,
    author: { "@type": "Person", name: b.a }, inLanguage: b.l,
    ...(b.y && { datePublished: String(b.y) }), ...(b.isbn && { isbn: b.isbn }),
    genre: (b.c || []).map(s => CAT_BY_SLUG[s]?.nom).filter(Boolean),
    image: coverUrl(b) || undefined, isAccessibleForFree: true,
    license: b.depot ? (LICENCES[b.licence]?.url || undefined) : LICENCES["domaine-public"].url,
    ...(b.liens?.epub && { workExample: { "@type": "Book", bookFormat: "https://schema.org/EBook", url: b.liens.epub } })
  };
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${esc(b.t)} — ${esc(b.a)} | ${esc(cfg.nom)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="book">
<meta property="og:title" content="${esc(b.t)} — ${esc(b.a)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${coverUrl(b) ? `<meta property="og:image" content="${esc(coverUrl(b))}">\n` : ""}${headCommon(root, cfg)}
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>
<body>
${siteHeader(root, cfg)}
<main id="contenu" class="wrap">
  ${renderBookMain(b, cfg, root, similaires)}
</main>
${siteFooter(root, cfg)}
</body>
</html>`;
}
