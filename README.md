# Velox Prestige

Vitrine statique, en français, d'une plateforme d'annonces automobiles d'exception (luxe, sportives, collection). Cette version présente le projet, la grille de tarifs de lancement et une liste d'attente. Aucun paiement, aucun compte, aucune annonce réelle.

Le site publié est servi à [https://ozenyi.github.io/velox-prestige/](https://ozenyi.github.io/velox-prestige/).

## Pages

| Page | Rôle |
|---|---|
| Accueil | Hero, recherche IA indiquée comme bientôt disponible, univers, illustrations, principes du lancement |
| Tarifs | Grille du 21 novembre 2026, sans encaissement |
| Liste d'attente | Parcours professionnels et particuliers |
| Mentions légales | Éditeur, hébergeur, champs encore à compléter |
| Confidentialité | Décrit le stockage réellement actif |
| Crédits | Licences des photos et des polices |
| 404 | Page introuvable |

Les véhicules montrés sont des illustrations. Ils n'ont ni prix, ni vendeur, ni kilométrage présenté comme une annonce.

## Construire

Node.js 20 ou plus récent. Aucune dépendance à installer.

```bash
node build.mjs
node scripts/check.mjs
node scripts/preview.mjs
```

La prévisualisation écoute sur [http://127.0.0.1:4173/velox-prestige/](http://127.0.0.1:4173/velox-prestige/). Le base path par défaut est `/velox-prestige`, celui d'un site de projet GitHub Pages. Pour un autre préfixe :

```bash
VELOX_BASE_PATH=/autre-prefixe node build.mjs
```

Le résultat est dans `dist/`, qui n'est pas versionné : GitHub Actions le reconstruit.

## Publication

Le workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) construit le site à chaque poussée sur `main` et le déploie avec les actions officielles GitHub Pages. Les pull requests construisent et vérifient, sans déployer.

Si le déploiement échoue parce que Pages n'a pas encore GitHub Actions comme source, il reste une étape manuelle :

1. Ouvrir **Settings → Pages** du dépôt.
2. Sous **Build and deployment**, choisir **Source : GitHub Actions**.
3. Relancer le workflow **Pages** sur `main`.

Aucun domaine n'est à acheter. L'adresse reste `https://ozenyi.github.io/velox-prestige/`.

## Liste d'attente

Une seule variable décide de l'envoi : l'URL d'un endpoint qui accepte un `POST` JSON (ou, pour Google Apps Script, un corps texte). Tant qu'elle est vide, le formulaire affiche « Les inscriptions ouvrent très bientôt » et n'envoie rien. La politique de confidentialité publiée décrit cet état. Il n'y a pas de cookie ni de traceur.

En local :

```bash
VELOX_WAITLIST_ENDPOINT="https://…" node build.mjs
```

Sur GitHub Actions, la même valeur est lue depuis la variable de dépôt `WAITLIST_ENDPOINT` (Settings → Secrets and variables → Actions → Variables). Ce n'est pas un secret : l'URL se retrouve dans le JavaScript public, comme toute adresse appelée par le navigateur.

Le build refuse de partir si une URL est définie alors que `contactEmail` est vide dans [`src/site.json`](src/site.json). Renseignez aussi l'adresse postale et le SIREN avant d'ouvrir la collecte : les mentions légales affichent `[à compléter]` tant que ces champs sont vides.

Champs envoyés, en JSON :

- professionnels : `parcours`, `societe`, `nom`, `email`, `telephone` (vide si absent), `ville`, `volume`, `consentement`
- particuliers : `parcours`, `nom`, `email`, `recherche`, `consentement`

Un champ honeypot (`vx_hp`) doit rester vide. La case de consentement n'est pas précochée.

### Option recommandée : Google Sheets

1. Créer un tableur Google au nom du responsable, avec un onglet `Inscriptions`.
2. Extensions → Apps Script, coller le script ci-dessous, et remplacer `SHEET_ID` par l'identifiant du tableur (la partie de l'URL entre `/d/` et `/edit`).
3. Déployer : **Déployer → Nouveau déploiement → Application web**. Exécuter en tant que soi, accès : **Tous les utilisateurs**.
4. Copier l'URL qui se termine par `/exec`.
5. La poser dans `WAITLIST_ENDPOINT`, remplir `contactEmail` dans `src/site.json`, puis laisser le workflow reconstruire le site.

```javascript
const SHEET_ID = "REMPLACER_PAR_L_ID_DU_TABLEUR";
const SHEET_NAME = "Inscriptions";

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  if (body.vx_hp) return text({ ok: true });
  if (body.consentement !== true) return text({ ok: false });
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["date", "parcours", "societe", "nom", "email", "telephone", "ville", "volume", "recherche", "consentement"]);
  }
  sheet.appendRow([
    new Date(),
    body.parcours || "",
    body.societe || "",
    body.nom || "",
    body.email || "",
    body.telephone || "",
    body.ville || "",
    body.volume || "",
    body.recherche || "",
    "oui"
  ]);
  return text({ ok: true });
}

function text(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
```

Le navigateur envoie le JSON en `text/plain` et ne peut pas lire la réponse de Google. Le site confirme l'envoi s'il n'y a pas d'erreur réseau, et le dit dans la politique de confidentialité. L'URL est publique : le tableur peut recevoir du bruit, le honeypot en retire une partie, et le déploiement Apps Script peut être renouvelé si l'adresse a fuité trop largement.

### Option Formspree

1. Créer un formulaire sur [formspree.io](https://formspree.io).
2. Copier l'URL `https://formspree.io/f/xxxxxxxx`.
3. La poser dans `WAITLIST_ENDPOINT` et renseigner `contactEmail`.

Le site envoie un `POST` `application/json` avec l'en-tête `Accept: application/json`. Formspree stocke la demande et peut l'envoyer par e-mail. La politique de confidentialité nomme alors Formspree comme sous-traitant.

### Autre endpoint

Toute URL HTTPS dont l'hôte n'est ni `formspree.io` ni `script.google.com` reçoit le même JSON, et la politique indique l'hôte. Le responsable doit pouvoir dire, sur demande, qui stocke les données et dans quel pays.

## Identité à compléter

Dans [`src/site.json`](src/site.json) :

- `contactEmail` — obligatoire dès que les inscriptions sont branchées
- `postalAddress`
- `siren`
- `director` et `holder` — déjà « Ozen Yigit »

## Photos et polices

Les fichiers d'origine des maquettes n'avaient pas d'auteur vérifiable. Ils ont été retirés. Les photos viennent d'Unsplash (licence Unsplash) et, pour la Jaguar Type E, de Wikimedia Commons (CC BY-SA 4.0, DeFacto). Le détail est sur la page Crédits. Cormorant Garamond et Outfit sont sous SIL Open Font License, textes dans `src/assets/fonts/`.

## Ce que ce site ne fait pas

Pas de paiement, pas de compte, pas de chiffre de fréquentation, pas d'avis, pas de logo partenaire, pas de cookie tiers.
