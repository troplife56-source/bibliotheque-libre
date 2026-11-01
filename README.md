# Bibliothèque Libre

Catalogue statique de livres du domaine public (environ 10 000 titres en français et en anglais, 22 catégories), avec :

- **recherche instantanée** insensible aux accents, filtres par catégorie et langue, tri, URL partageable ;
- **une page par livre** optimisée pour Google (données structurées schema.org, sitemap) ;
- **liseuse EPUB en ligne** qui mémorise la page atteinte ;
- **collections éditoriales** (sélection, poésie française, aventures, policier…) ;
- **liens affiliés** vers les éditions papier (Amazon, Fnac, Kobo), désactivés tant que vous n'avez pas vos identifiants ;
- **dépôt gratuit par les auteurs**, avec choix d'une licence Creative Commons, modération avant publication et bouton « Signaler » ;
- **mode hors ligne** (PWA) : le site s'installe comme une appli sur téléphone.

Hébergement 100 % gratuit : GitHub Pages pour le site, Supabase (offre gratuite) pour le dépôt. Aucun fichier EPUB/PDF du domaine public n'est stocké chez vous.

---

## Structure

```
site/                    ← le site (copié dans dist/ au build)
  config.js              ← ★ LE fichier à personnaliser
  index.html             ← catalogue
  lire.html              ← liseuse EPUB
  deposer.html           ← dépôt par les auteurs
  moderation.html        ← validation des dépôts (réservé aux admins)
  livre.html             ← fiche d'un livre tout juste validé
  mentions.html          ← mentions légales, RGPD, conditions de dépôt (à compléter)
  sw.js, manifest.webmanifest, icon*.{svg,png}   ← mode hors ligne / appli
  assets/                ← CSS et JavaScript
data/
  collections.json       ← vos collections (modifiables)
  manual.json            ← corrections et ajouts manuels de livres
  exemple-gutendex.json  ← petit échantillon pour le mode démo
scripts/
  build.mjs              ← génère dist/ : catalogue, pages des livres, sitemap
  serve.mjs              ← aperçu local
supabase/schema.sql      ← base de données et règles de sécurité du dépôt
.github/workflows/deploy.yml  ← construction et publication automatiques
```

## Mise en ligne en 5 étapes

1. **Créez un dépôt GitHub** (par exemple `bibliotheque-libre`) et envoyez-y tous les fichiers : bouton *Add file → Upload files*, puis glissez le contenu du dossier.
   Le dossier `.github` est parfois masqué par l'ordinateur. Si besoin, créez-le directement sur GitHub : *Add file → Create new file*, nommez le fichier `.github/workflows/deploy.yml` et collez son contenu.
2. **Modifiez `site/config.js`** : `urlSite` = `https://VOTRE-PSEUDO.github.io/bibliotheque-libre` (sans slash final), puis votre e-mail de contact.
3. **Activez GitHub Pages** : *Settings → Pages → Source : GitHub Actions*.
4. **Lancez le premier build** : onglet *Actions → Construire et publier → Run workflow*. Le premier dure 15 à 30 minutes (téléchargement du catalogue). Les suivants prennent 2 à 3 minutes grâce au cache.
5. **Complétez `site/mentions.html`** (nom, adresse, statut).

Le catalogue se met ensuite à jour **tout seul chaque lundi**.

## Tester sur votre ordinateur (facultatif)

Node.js 18 ou plus récent, aucune installation de paquet :

```bash
npm run demo     # build hors ligne avec 9 livres d'exemple
npm run serve    # → http://localhost:8080
npm run build    # build complet (télécharge ~10 000 livres)
```

## Régler la taille du catalogue

Dans `site/config.js` → `catalogue` :

| Réglage | Effet |
|---|---|
| `langues: ["fr", "en"]` | Ajoutez `"es"`, `"de"`, `"it"`… |
| `maxParLangue: 5000` | Project Gutenberg propose environ 79 000 livres au total, dont quelques milliers en français. |
| `enrichir: 300` | Les N livres les plus lus sont complétés via Open Library (année de publication, ISBN pour l'affiliation). |

Au-delà d'environ 30 000 livres, le fichier de recherche devient lourd sur mobile (plus de 3 Mo). Mieux vaut alors privilégier la qualité à la quantité.

**Ajouter un livre d'une autre source** (Gallica, Internet Archive) : ajoutez-le dans `data/manual.json` avec un `id` unique (`gallica-…`, `ia-…`). Un exemple est fourni dans le fichier.
**Corriger une fiche** : même fichier, avec l'`id` du livre (`gut-14155`) et les champs à remplacer.
**Retirer un livre** : `{ "id": "gut-1234", "supprimer": true }`.

## Activer l'affiliation

1. Inscrivez-vous aux programmes : **Amazon Partenaires** (affiliate-program.amazon.fr), **Awin** pour la Fnac, **Rakuten Advertising** pour Kobo.
2. Dans `site/config.js` → `affiliation`, remplacez les `VOTRE_…` / `ID_MARCHAND_…` par vos identifiants et passez `actif: true`.
3. Poussez la modification : les boutons « Éditions papier et commentées » apparaissent sur toutes les fiches, avec la mention légale « lien affilié ».

Amazon exige généralement quelques ventes dans les premiers mois pour valider le compte : inscrivez-vous plutôt quand le site a du trafic.

## Activer le dépôt gratuit (Supabase)

1. Créez un projet gratuit sur **supabase.com** (choisissez une région européenne).
2. *SQL Editor → New query* : collez `supabase/schema.sql`, puis *Run*.
3. *Authentication → URL Configuration* : **Site URL** = votre `urlSite`. Dans **Redirect URLs**, ajoutez `https://VOTRE-PSEUDO.github.io/bibliotheque-libre/**`.
4. *Project Settings → API* : copiez **Project URL** et la clé **anon public** dans `site/config.js` → `supabase`.
5. Poussez la modification : le menu « Déposer un livre » apparaît.
6. **Devenez modérateur** : connectez-vous une fois sur `/moderation.html`, puis exécutez dans le SQL Editor :
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'votre@email.fr';
   ```

Fonctionnement : l'auteur se connecte par lien e-mail, remplit le formulaire, choisit sa licence et certifie détenir les droits. Le livre reste « en attente » jusqu'à votre validation sur `moderation.html`. Une fois validé, il apparaît immédiatement dans le catalogue, et sa page référencée sur Google est créée au build suivant. Les signalements arrivent sur la même page.

Sécurité : la clé « anon » est publique par conception. Tout est verrouillé par les règles RLS : un auteur n'écrit que dans son propre dossier et ne peut pas publier son livre lui-même, 5 dépôts en attente maximum par compte, seuls les admins modèrent. Les fichiers en attente restent techniquement accessibles à qui connaît leur adresse exacte (identifiant aléatoire impossible à deviner).

L'offre gratuite de Supabase inclut 1 Go de stockage (environ 500 livres EPUB) et met le projet en pause après une semaine sans aucune activité. Une simple visite le réveille.

## Options

- **Newsletter** : créez un compte gratuit sur buttondown.com et mettez votre identifiant dans `newsletter.buttondown`.
- **Statistiques sans cookie** : créez un compte gratuit sur goatcounter.com et mettez votre code dans `analytics.goatcounter`.
- **Collections** : modifiez `data/collections.json`, soit par liste d'`ids`, soit par `filtre` (`categorie`, `langue`, `depot`) avec `tri` et `limite`.
- **Après avoir modifié le CSS ou le JS**, incrémentez `VERSION` dans `site/sw.js` pour que les visiteurs reçoivent la nouvelle version.

## Bon à savoir

- **Liseuse** : certaines sources n'autorisent pas la lecture directe depuis un autre site. La liseuse propose alors automatiquement le téléchargement ou la version HTML. Les livres déposés sur Supabase s'ouvrent toujours.
- **Droit** : une œuvre du domaine public aux États-Unis (Gutenberg) peut encore être protégée en France, où les droits durent 70 ans après la mort de l'auteur. Le catalogue est filtré sur `copyright=false`, mais pour les auteurs morts après 1955, vérifiez au cas par cas.
- `mentions.html` est un modèle : faites-le relire avant d'ouvrir le dépôt.
