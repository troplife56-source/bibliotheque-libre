// ============================================================
//  CONFIGURATION DU SITE — le seul fichier à modifier au départ
//  (lu à la fois par le navigateur et par le script de build)
// ============================================================
export default {
  nom: "Bibliothèque Libre",
  slogan: "Les classiques du domaine public, gratuits et à portée de clic.",

  // Adresse publique du site, SANS slash final.
  // GitHub Pages : https://VOTRE-PSEUDO.github.io/NOM-DU-DEPOT
  urlSite: "https://troplife56-source.github.io/bibliotheque-libre",

  contact: "contact@exemple.fr",

  // ---------- Catalogue automatique (Project Gutenberg via Gutendex) ----------
  catalogue: {
    langues: ["fr", "en"],   // codes ISO : fr, en, es, de, it, pt…
    maxParLangue: 5000,      // 5 000 × 2 langues ≈ 10 000 livres
    enrichir: 300,           // nb de livres (les plus populaires) complétés via Open Library (année, ISBN)
    cacheJours: 6            // on ne re-télécharge le catalogue qu'une fois par semaine
  },

  // ---------- Affiliation ----------
  // Passez "actif" à true après inscription et remplacement des VOTRE_… par vos identifiants.
  // {q} = recherche (ISBN si connu, sinon titre + auteur) ; {url} = la page "cible" encodée.
  affiliation: {
    programmes: [
      {
        nom: "Amazon",
        actif: false,
        modele: "https://www.amazon.fr/s?k={q}&i=stripbooks&tag=VOTRE-TAG-21"
      },
      {
        nom: "Fnac",
        actif: false,
        cible: "https://www.fnac.com/SearchResult/ResultList.aspx?Search={q}",
        modele: "https://www.awin1.com/cread.php?awinmid=ID_MARCHAND_FNAC&awinaffid=VOTRE_ID_AWIN&ued={url}"
      },
      {
        nom: "Kobo",
        actif: false,
        cible: "https://www.kobo.com/fr/fr/search?query={q}",
        modele: "https://click.linksynergy.com/deeplink?id=VOTRE_ID_RAKUTEN&mid=ID_MARCHAND_KOBO&murl={url}"
      }
    ]
  },

  // ---------- Dépôt gratuit par les auteurs (Supabase) ----------
  // Laissez vide pour désactiver. La clé "anon" est publique par conception :
  // la sécurité repose sur les règles RLS de supabase/schema.sql.
  supabase: {
    url: "",       // ex : https://abcdefgh.supabase.co
    anonKey: ""
  },

  // ---------- Options ----------
  newsletter: { buttondown: "" },   // votre identifiant Buttondown (gratuit) — vide = masqué
  analytics: { goatcounter: "" }    // votre code GoatCounter (sans cookie) — vide = désactivé
};
