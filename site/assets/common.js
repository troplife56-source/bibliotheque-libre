// Chargé sur toutes les pages : couvertures de secours, mode hors ligne, signalements.

// Couverture de secours quand l'image distante ne se charge pas
document.addEventListener("error", e => {
  const img = e.target;
  if (img.tagName === "IMG" && img.dataset.fallback && img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
}, true);
// Images déjà en échec avant le chargement de ce script
for (const img of document.querySelectorAll("img[data-fallback]")) {
  if (img.complete && img.naturalWidth === 0 && img.src !== img.dataset.fallback) img.src = img.dataset.fallback;
}

// Mode hors ligne (PWA)
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register(new URL("../sw.js", import.meta.url)).catch(() => {});
}

// Google Tag : chargé UNIQUEMENT après accord du visiteur (obligatoire en France / UE — règles CNIL)
const gaId = document.querySelector('meta[name="ga-id"]')?.content;
if (gaId) consentementCookies(gaId);

function consentementCookies(id) {
  const KEY = "consentement-cookies";
  const lire = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
  const ecrire = v => { try { localStorage.setItem(KEY, v); } catch {} };

  const charger = () => {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.append(s);
  };

  const bandeau = () => {
    document.querySelector(".cookie-banner")?.remove();
    const box = document.createElement("div");
    box.className = "cookie-banner";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "Cookies");
    const p = document.createElement("p");
    p.append("Nous aimerions mesurer l'audience du site avec Google Analytics, qui dépose des cookies. Vous pouvez accepter ou refuser, le site fonctionne de la même façon. ");
    const lien = Object.assign(document.createElement("a"), { href: new URL("../mentions.html#cookies", import.meta.url).href, textContent: "En savoir plus" });
    p.append(lien);
    const choix = document.createElement("div");
    const bouton = (texte, valeur) => {
      const b = Object.assign(document.createElement("button"), { type: "button", textContent: texte, className: "btn" });
      b.addEventListener("click", () => {
        const avant = lire();
        ecrire(valeur);
        box.remove();
        if (valeur === "oui") charger();
        else if (avant === "oui") location.reload(); // arrête Google Analytics immédiatement
      });
      return b;
    };
    choix.append(bouton("Refuser", "non"), bouton("Accepter", "oui"));
    box.append(p, choix);
    document.body.append(box);
  };

  const choix = lire();
  if (choix === "oui") charger();
  else if (!choix) bandeau();

  document.addEventListener("click", e => {
    if (e.target.closest("[data-cookies]")) { e.preventDefault(); bandeau(); }
  });
}

// Bouton « Signaler ce livre » (pages de livres déposés)
document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-signaler]");
  if (!btn) return;
  const { ouvrirSignalement } = await import("./supa.js");
  ouvrirSignalement(btn.dataset.signaler);
});
