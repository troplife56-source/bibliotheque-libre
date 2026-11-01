// Accès à Supabase (chargé uniquement quand c'est nécessaire).
import cfg from "../config.js";

let client;
export async function supa() {
  if (!client) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    client = createClient(cfg.supabase.url, cfg.supabase.anonKey);
  }
  return client;
}

/** Connexion par lien magique envoyé par e-mail (pas de mot de passe à gérer). */
export async function connexion(email) {
  const { error } = await (await supa()).auth.signInWithOtp({
    email, options: { emailRedirectTo: location.href.split("#")[0] }
  });
  if (error) throw error;
}

export async function utilisateur() {
  const { data } = await (await supa()).auth.getSession();
  return data.session?.user || null;
}

export async function deconnexion() {
  await (await supa()).auth.signOut();
  location.reload();
}

/** Construit un élément DOM : el("p", { class: "x" }, "texte", enfant…) — jamais d'innerHTML. */
export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.flat().filter(k => k != null && k !== false));
  return n;
}

/** Boîte de dialogue « Signaler ce livre » (procédure de notification, exigée par le DSA). */
export function ouvrirSignalement(depotId) {
  const msg = el("p", { class: "form-msg", role: "status" });
  const form = el("form", { method: "dialog", class: "form" },
    el("h2", {}, "Signaler ce livre"),
    el("label", {}, "Motif",
      el("select", { name: "motif", required: true },
        el("option", { value: "droits" }, "Violation de droits d'auteur"),
        el("option", { value: "contenu_illicite" }, "Contenu illicite ou choquant"),
        el("option", { value: "spam" }, "Spam ou arnaque"),
        el("option", { value: "autre" }, "Autre"))),
    el("label", {}, "Détails", el("textarea", { name: "details", rows: 4, maxlength: 1000, required: true })),
    el("label", {}, "Votre e-mail (facultatif, pour être tenu informé)", el("input", { name: "contact", type: "email", maxlength: 200 })),
    msg,
    el("div", { class: "actions" },
      el("button", { class: "btn", type: "submit", value: "envoyer" }, "Envoyer"),
      el("button", { class: "btn btn-3", type: "button", onclick: () => dlg.close() }, "Annuler")));
  const dlg = el("dialog", { class: "modal" }, form);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(form);
    try {
      const { error } = await (await supa()).from("signalements").insert({
        depot_id: depotId, motif: f.get("motif"), details: f.get("details"), contact: f.get("contact") || null
      });
      if (error) throw error;
      form.replaceChildren(el("h2", {}, "Merci"), el("p", {}, "Votre signalement a été transmis à l'équipe de modération."),
        el("button", { class: "btn", type: "button", onclick: () => dlg.close() }, "Fermer"));
    } catch (err) { msg.textContent = "Échec de l'envoi : " + err.message; }
  });
  dlg.addEventListener("close", () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
