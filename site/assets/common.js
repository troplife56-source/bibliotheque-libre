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

// Bouton « Signaler ce livre » (pages de livres déposés)
document.addEventListener("click", async e => {
  const btn = e.target.closest("[data-signaler]");
  if (!btn) return;
  const { ouvrirSignalement } = await import("./supa.js");
  ouvrirSignalement(btn.dataset.signaler);
});
