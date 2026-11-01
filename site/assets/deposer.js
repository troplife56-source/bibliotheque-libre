// Dépôt gratuit d'un livre par son auteur (Supabase : connexion par e-mail, stockage, base de données).
import cfg from "../config.js";
import { CATEGORIES, LANGUES, LICENCES, supabaseActif } from "./shared.js";

const app = document.querySelector("#app");
const MAX_LIVRE = 25 * 1024 * 1024, MAX_COUV = 2 * 1024 * 1024;

if (!supabaseActif(cfg)) {
  app.innerHTML = '<p class="panel">Le dépôt de livres n\'est pas encore ouvert. Revenez bientôt !</p>';
} else {
  const S = await import("./supa.js");
  const { el } = S;
  const user = await S.utilisateur();
  app.replaceChildren(user ? formulaire(S, el, user) : connexion(S, el));
  if (user) app.append(await mesDepots(S, el, user));
}

function connexion(S, el) {
  const msg = el("p", { class: "form-msg", role: "status" });
  const form = el("form", { class: "form panel" },
    el("h2", {}, "1. Connectez-vous"),
    el("p", { class: "hint" }, "Recevez un lien de connexion par e-mail : pas de mot de passe à retenir."),
    el("label", {}, "Votre e-mail", el("input", { type: "email", name: "email", required: true, autocomplete: "email" })),
    el("button", { class: "btn", type: "submit" }, "Recevoir le lien"), msg);
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = form.querySelector("button"); btn.disabled = true;
    try {
      await S.connexion(new FormData(form).get("email"));
      msg.className = "form-msg ok"; msg.textContent = "C'est envoyé ! Ouvrez le lien reçu par e-mail sur cet appareil.";
    } catch (err) { msg.className = "form-msg err"; msg.textContent = "Erreur : " + err.message; btn.disabled = false; }
  });
  return form;
}

function formulaire(S, el, user) {
  const msg = el("p", { class: "form-msg", role: "status" });
  const opt = (v, t) => el("option", { value: v }, t);
  const form = el("form", { class: "form panel" },
    el("h2", {}, "2. Votre livre"),
    el("p", { class: "hint" }, `Connecté : ${user.email} · `, el("button", { type: "button", class: "link-btn", onclick: S.deconnexion }, "se déconnecter")),
    el("label", {}, "Titre", el("input", { name: "titre", required: true, maxlength: 200 })),
    el("div", { class: "row2" },
      el("label", {}, "Auteur (nom affiché)", el("input", { name: "auteur", required: true, maxlength: 120 })),
      el("label", {}, "Année de publication", el("input", { name: "annee", type: "number", min: 1000, max: new Date().getFullYear() }))),
    el("label", {}, "Présentation", el("span", { class: "hint" }, "Quelques lignes pour donner envie (2 000 caractères max)."),
      el("textarea", { name: "description", rows: 5, maxlength: 2000, required: true })),
    el("div", { class: "row2" },
      el("label", {}, "Catégorie", el("select", { name: "categorie", required: true },
        CATEGORIES.map(c => opt(c.slug, c.nom)))),
      el("label", {}, "Langue", el("select", { name: "langue", required: true },
        Object.entries(LANGUES).map(([k, v]) => opt(k, v))))),
    el("label", {}, "Licence", el("span", { class: "hint" }, "Ce que les lecteurs ont le droit de faire avec votre livre. En cas de doute, CC BY-NC-ND est la plus protectrice."),
      el("select", { name: "licence", required: true },
        Object.entries(LICENCES).map(([k, v]) => opt(k, v.nom)))),
    el("label", {}, "Fichier du livre (EPUB ou PDF, 25 Mo max)",
      el("input", { name: "fichier", type: "file", accept: ".epub,.pdf,application/epub+zip,application/pdf", required: true })),
    el("label", {}, "Couverture (JPG, PNG ou WebP, 2 Mo max — facultatif)",
      el("input", { name: "couverture", type: "file", accept: "image/jpeg,image/png,image/webp" })),
    el("label", { class: "check" }, el("input", { type: "checkbox", name: "certifie", required: true }),
      el("span", {}, "Je certifie être l'auteur de ce livre ou détenir les droits nécessaires pour le diffuser gratuitement. J'accepte les ",
        el("a", { href: "mentions.html#depot", target: "_blank" }, "conditions de dépôt"), ".")),
    el("button", { class: "btn", type: "submit" }, "Envoyer pour validation"), msg);

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const f = new FormData(form);
    const fichier = f.get("fichier"), couv = f.get("couverture");
    const ext = fichier.name.toLowerCase().endsWith(".pdf") ? "pdf" : fichier.name.toLowerCase().endsWith(".epub") ? "epub" : null;
    const erreur = t => { msg.className = "form-msg err"; msg.textContent = t; };
    if (!ext) return erreur("Le fichier doit être un EPUB ou un PDF.");
    if (fichier.size > MAX_LIVRE) return erreur("Le fichier dépasse 25 Mo.");
    if (couv?.size && couv.size > MAX_COUV) return erreur("La couverture dépasse 2 Mo.");

    const btn = form.querySelector("button[type=submit]"); btn.disabled = true;
    msg.className = "form-msg"; msg.textContent = "Envoi en cours…";
    const sb = await S.supa();
    const id = crypto.randomUUID();
    const fichierPath = `${user.id}/${id}.${ext}`;
    let couvPath = null;
    try {
      let r = await sb.storage.from("livres").upload(fichierPath, fichier, { contentType: ext === "pdf" ? "application/pdf" : "application/epub+zip" });
      if (r.error) throw r.error;
      if (couv?.size) {
        couvPath = `${user.id}/${id}.${couv.type.split("/")[1].replace("jpeg", "jpg")}`;
        r = await sb.storage.from("couvertures").upload(couvPath, couv, { contentType: couv.type });
        if (r.error) throw r.error;
      }
      r = await sb.from("depots").insert({
        id, user_id: user.id, titre: f.get("titre").trim(), auteur: f.get("auteur").trim(),
        annee: f.get("annee") ? Number(f.get("annee")) : null, description: f.get("description").trim(),
        categorie: f.get("categorie"), langue: f.get("langue"), licence: f.get("licence"),
        format: ext, fichier_path: fichierPath, couverture_path: couvPath, certifie_droits: true
      });
      if (r.error) throw r.error;
      form.replaceChildren(el("h2", {}, "Merci !"),
        el("p", {}, "Votre livre a bien été reçu. Il sera publié après vérification par notre équipe."),
        el("button", { class: "btn btn-2", type: "button", onclick: () => location.reload() }, "Déposer un autre livre"));
    } catch (err) {
      // Nettoyage des fichiers déjà envoyés si l'enregistrement a échoué
      await sb.storage.from("livres").remove([fichierPath]).catch(() => {});
      if (couvPath) await sb.storage.from("couvertures").remove([couvPath]).catch(() => {});
      erreur(/en_attente|row-level|policy/i.test(err.message)
        ? "Dépôt refusé : vous avez peut-être déjà 5 livres en attente de validation."
        : "Erreur : " + err.message);
      btn.disabled = false;
    }
  });
  return form;
}

async function mesDepots(S, el, user) {
  const { data } = await (await S.supa()).from("depots").select("id,titre,status,motif_refus,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  const LIB = { en_attente: "En attente", publie: "Publié", refuse: "Refusé", depublie: "Retiré" };
  return el("section", { class: "panel" },
    el("h2", {}, "Mes dépôts"),
    data?.length
      ? el("ul", { class: "list" }, data.map(d => el("li", {},
          el("strong", {}, d.titre), " ", el("span", { class: `status status-${d.status}` }, LIB[d.status] || d.status),
          d.status === "publie" ? el("div", {}, el("a", { href: `livre.html?depot=${d.id}` }, "Voir la page")) : null,
          d.motif_refus ? el("p", { class: "hint" }, "Motif : " + d.motif_refus) : null)))
      : el("p", { class: "hint" }, "Aucun dépôt pour l'instant."));
}
