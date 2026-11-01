// Espace de modération : validation des dépôts et traitement des signalements.
// L'accès est protégé côté serveur par les règles RLS (table "admins") : cette page seule ne donne aucun droit.
import cfg from "../config.js";
import { CAT_BY_SLUG, LICENCES, publicFileUrl, supabaseActif } from "./shared.js";

const app = document.querySelector("#app");

if (!supabaseActif(cfg)) {
  app.textContent = "Supabase n'est pas configuré (voir config.js).";
} else {
  const S = await import("./supa.js");
  const { el } = S;
  const sb = await S.supa();
  const user = await S.utilisateur();

  if (!user) {
    const msg = el("p", { class: "form-msg" });
    const form = el("form", { class: "form panel" },
      el("label", {}, "E-mail administrateur", el("input", { type: "email", name: "email", required: true })),
      el("button", { class: "btn" }, "Recevoir le lien de connexion"), msg);
    form.onsubmit = async e => {
      e.preventDefault();
      try { await S.connexion(new FormData(form).get("email")); msg.textContent = "Lien envoyé, consultez vos e-mails."; }
      catch (err) { msg.textContent = err.message; }
    };
    app.replaceChildren(form);
  } else {
    const { data: admin } = await sb.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!admin) {
      app.replaceChildren(el("p", { class: "panel" }, `Le compte ${user.email} n'a pas les droits de modération. `,
        el("button", { class: "link-btn", onclick: S.deconnexion }, "Se déconnecter")));
    } else {
      await afficher();
    }
  }

  async function afficher() {
    const [dep, sig] = await Promise.all([
      sb.from("depots").select("*").eq("status", "en_attente").order("created_at"),
      sb.from("signalements").select("*, depots(id,titre,auteur,status)").eq("traite", false).order("created_at")
    ]);
    app.replaceChildren(
      el("p", { class: "hint" }, `Connecté : ${user.email} · `, el("button", { class: "link-btn", onclick: S.deconnexion }, "se déconnecter")),
      el("section", { class: "panel" },
        el("h2", {}, `Dépôts en attente (${dep.data?.length || 0})`),
        dep.error ? el("p", { class: "form-msg err" }, dep.error.message) :
        dep.data.length ? el("ul", { class: "list" }, dep.data.map(carteDepot)) : el("p", { class: "hint" }, "Rien à valider.")),
      el("section", { class: "panel" },
        el("h2", {}, `Signalements à traiter (${sig.data?.length || 0})`),
        sig.error ? el("p", { class: "form-msg err" }, sig.error.message) :
        sig.data.length ? el("ul", { class: "list" }, sig.data.map(carteSignalement)) : el("p", { class: "hint" }, "Aucun signalement.")),
      el("p", { class: "hint" }, "Après validation, le livre apparaît immédiatement dans le catalogue. Il aura sa page référencée sur Google au prochain build (automatique chaque semaine, ou via « Run workflow » sur GitHub)."));
  }

  function carteDepot(d) {
    const fichier = publicFileUrl(cfg, "livres", d.fichier_path);
    const couv = publicFileUrl(cfg, "couvertures", d.couverture_path);
    return el("li", {},
      couv ? el("img", { src: couv, alt: "", width: 70, style: "float:right;border-radius:6px;margin-left:10px" }) : null,
      el("strong", {}, d.titre), ` — ${d.auteur}${d.annee ? ", " + d.annee : ""}`,
      el("p", { class: "hint" }, `${CAT_BY_SLUG[d.categorie]?.nom || d.categorie} · ${d.langue} · ${LICENCES[d.licence]?.nom || d.licence} · ${d.format.toUpperCase()} · reçu le ${new Date(d.created_at).toLocaleDateString("fr-FR")}`),
      el("p", {}, d.description || ""),
      el("p", {}, el("a", { href: fichier, target: "_blank", rel: "noopener" }, "Ouvrir le fichier pour vérification")),
      el("p", { class: "hint" }, "Vérifiez : contenu lisible et complet, pas de copie d'un livre protégé (recherchez quelques phrases sur le web), pas de contenu illicite."),
      el("div", { class: "actions" },
        el("button", { class: "btn", onclick: () => statut(d.id, "publie") }, "Publier"),
        el("button", { class: "btn btn-3", onclick: () => {
          const motif = prompt("Motif du refus (visible par l'auteur) :");
          if (motif !== null) statut(d.id, "refuse", motif);
        } }, "Refuser")));
  }

  function carteSignalement(s) {
    const MOTIFS = { droits: "Droits d'auteur", contenu_illicite: "Contenu illicite", spam: "Spam", autre: "Autre" };
    return el("li", {},
      el("strong", {}, MOTIFS[s.motif] || s.motif), " · ",
      s.depots ? el("a", { href: `livre.html?depot=${s.depot_id}`, target: "_blank" }, s.depots.titre) : "livre supprimé",
      s.depots ? el("span", { class: `status status-${s.depots.status}`, style: "margin-left:6px" }, s.depots.status) : null,
      el("p", {}, s.details || ""),
      s.contact ? el("p", { class: "hint" }, "Contact : " + s.contact) : null,
      el("div", { class: "actions" },
        s.depots?.status === "publie" ? el("button", { class: "btn", onclick: async () => {
          await statut(s.depot_id, "depublie", "Retiré suite à un signalement : " + (MOTIFS[s.motif] || s.motif), false);
          await traiter(s.id);
        } }, "Retirer le livre") : null,
        el("button", { class: "btn btn-3", onclick: () => traiter(s.id) }, "Classer sans suite")));
  }

  async function statut(id, status, motif = null, rafraichir = true) {
    const { error } = await sb.from("depots").update({ status, motif_refus: motif, moderated_at: new Date().toISOString() }).eq("id", id);
    if (error) alert(error.message); else if (rafraichir) afficher();
  }
  async function traiter(id) {
    const { error } = await sb.from("signalements").update({ traite: true }).eq("id", id);
    if (error) alert(error.message); else afficher();
  }
}
