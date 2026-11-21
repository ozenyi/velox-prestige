import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, "src");
const dist = path.join(root, "dist");

const site = JSON.parse(fs.readFileSync(path.join(src, "site.json"), "utf8"));
const base = normalizeBase(process.env.VELOX_BASE_PATH ?? "/velox-prestige");
const origin = (process.env.VELOX_ORIGIN || "https://ozenyi.github.io").replace(/\/$/, "");
const endpoint = (process.env.VELOX_WAITLIST_ENDPOINT || "").trim();
const provider = detectProvider(endpoint);
const year = "2026";

if (endpoint && !String(site.contactEmail || "").trim()) {
  console.error(
    "VELOX_WAITLIST_ENDPOINT est défini, mais contactEmail est vide dans src/site.json.\n" +
      "Renseignez l'adresse qui servira à exercer les droits avant d'ouvrir les inscriptions."
  );
  process.exit(1);
}

const partials = {};
for (const file of fs.readdirSync(path.join(src, "partials"))) {
  if (!file.endsWith(".html")) continue;
  partials[file.slice(0, -5)] = fs.readFileSync(path.join(src, "partials", file), "utf8");
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
copyDir(path.join(src, "assets"), path.join(dist, "assets"));
fs.mkdirSync(path.join(dist, "assets", "css"), { recursive: true });
fs.mkdirSync(path.join(dist, "assets", "js"), { recursive: true });
fs.copyFileSync(path.join(src, "css", "site.css"), path.join(dist, "assets", "css", "site.css"));
fs.copyFileSync(path.join(src, "js", "main.js"), path.join(dist, "assets", "js", "main.js"));
fs.writeFileSync(
  path.join(dist, "assets", "js", "config.js"),
  `window.VELOX_CONFIG=${JSON.stringify({ waitlistEndpoint: endpoint, provider })};\n`
);

const pages = [
  {
    file: "index.html",
    title: "Velox Prestige — Automobiles d'exception",
    description:
      "Velox Prestige prépare une plateforme française d'annonces de supercars, GT, voitures de collection et SUV de luxe. Tarifs de lancement publics, liste d'attente, aucun paiement ouvert.",
    path: "/",
    nav: "accueil",
    navClass: "",
  },
  {
    file: "tarifs.html",
    title: "Tarifs de lancement — Velox Prestige",
    description:
      "Grille de lancement Velox Prestige : annonce particulier gratuite ou Premium 19 € TTC, packs pros 99, 249 et 499 € HT par mois, Velox Plus 12,90 € par mois. Aucun paiement sur ce site.",
    path: "/tarifs.html",
    nav: "tarifs",
    navClass: "solid",
  },
  {
    file: "liste-attente.html",
    title: "Liste d'attente — Velox Prestige",
    description:
      "Inscrivez-vous pour être informé du lancement de Velox Prestige, que vous soyez professionnel ou particulier. Aucune donnée n'est enregistrée tant que le stockage n'est pas branché.",
    path: "/liste-attente.html",
    nav: "liste",
    navClass: "solid",
  },
  {
    file: "mentions-legales.html",
    title: "Mentions légales — Velox Prestige",
    description:
      "Mentions légales de Velox Prestige, projet porté par Ozen Yigit. Éditeur, hébergeur GitHub Pages, propriété des contenus.",
    path: "/mentions-legales.html",
    nav: "",
    navClass: "solid",
  },
  {
    file: "confidentialite.html",
    title: "Politique de confidentialité — Velox Prestige",
    description:
      "Politique de confidentialité de Velox Prestige : finalité de la liste d'attente, responsable de traitement, durée de conservation, droits et absence de cookies.",
    path: "/confidentialite.html",
    nav: "",
    navClass: "solid",
  },
  {
    file: "credits.html",
    title: "Crédits photographiques — Velox Prestige",
    description:
      "Sources et licences des photographies et des polices utilisées sur le site Velox Prestige.",
    path: "/credits.html",
    nav: "",
    navClass: "solid",
  },
  {
    file: "404.html",
    title: "Page introuvable — Velox Prestige",
    description: "Cette page n'existe pas sur Velox Prestige.",
    path: "/404.html",
    nav: "",
    navClass: "solid",
  },
];

const common = {
  BASE: base,
  ORIGIN: origin,
  YEAR: year,
  ADDRESS: placeholder(site.postalAddress, "adresse à compléter"),
  SIREN: placeholder(site.siren, "SIREN à compléter"),
  EMAIL_HTML: emailHtml(site.contactEmail),
  STORAGE: storageHtml(provider, endpoint),
  FORM_NOTICE: formNotice(provider),
  DIRECTOR: site.director,
  CONTROLLER: site.controller,
  HOLDER: site.holder,
};

for (const page of pages) {
  const template = fs.readFileSync(path.join(src, "pages", page.file), "utf8");
  const html = render(template, {
    ...common,
    TITLE: page.title,
    DESCRIPTION: page.description,
    CANONICAL: origin + base + (page.path === "/" ? "/" : page.path),
    NAV_CLASS: page.navClass,
    NAV_ACCUEIL: page.nav === "accueil" ? "is-active" : "",
    NAV_TARIFS: page.nav === "tarifs" ? "is-active" : "",
    NAV_PRO: page.nav === "pro" ? "is-active" : "",
    NAV_PLUS: page.nav === "plus" ? "is-active" : "",
    NAV_LISTE: page.nav === "liste" ? "is-active" : "",
    EXTRA_HEAD: page.file === "index.html" ? preloadHero(base) : "",
  });
  fs.writeFileSync(path.join(dist, page.file), html);
}

const urls = pages
  .filter((page) => page.file !== "404.html")
  .map((page) => `  <url><loc>${origin}${base}${page.path === "/" ? "/" : page.path}</loc></url>`)
  .join("\n");
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
);
fs.writeFileSync(
  path.join(dist, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${origin}${base}/sitemap.xml\n`
);
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

console.log(`Site construit dans dist/ (base ${base || "/"}, inscriptions : ${provider}).`);

function render(template, vars) {
  let html = template.replace(/\{\{>\s*([a-z0-9-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Fragment manquant : ${name}`);
    return partials[name];
  });
  html = html.replace(/\{\{\{([A-Z0-9_]+)\}\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Valeur HTML manquante : ${key}`);
    return String(vars[key]);
  });
  html = html.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`Valeur manquante : ${key}`);
    return escapeHtml(vars[key]);
  });
  if (html.includes("{{")) throw new Error("Jeton non résolu dans une page.");
  return html;
}

function preloadHero(basePath) {
  return `<link rel="preload" href="${basePath}/assets/images/hero-panamera.webp" as="image" type="image/webp" fetchpriority="high">`;
}

function storageHtml(kind, url) {
  const rights = `Vous pouvez demander l'accès, la rectification, l'effacement, la limitation, l'opposition et, le cas échéant, la portabilité, ainsi que retirer votre consentement à tout moment. Ces droits s'exercent auprès d'${escapeHtml(site.controller)} à l'adresse indiquée dans les <a href="${base}/mentions-legales.html">mentions légales</a>. Vous pouvez aussi saisir la CNIL (cnil.fr).`;
  const purpose = `La seule finalité est de vous informer du lancement de Velox Prestige. Les données ne sont pas utilisées pour de la publicité, de la prospection tierce, ni pour établir un profil commercial.`;
  const duration = `Durée de conservation prévue : jusqu'à l'envoi de l'information de lancement, puis trois mois, et au plus tard trente-six mois après l'inscription. Vous pouvez demander l'effacement avant.`;
  const fields = `Champs concernés : pour un professionnel, la société, le nom, l'adresse e-mail, le téléphone s'il est renseigné, la ville et le volume de stock approximatif ; pour un particulier, le nom, l'adresse e-mail et ce qui est recherché. Un champ anti-spam (honeypot) est ignoré s'il est rempli. La case de consentement, non précochée, est enregistrée avec la demande.`;

  if (kind === "none") {
    return `
      <p>Aucune inscription n'est collectée pour le moment. Le formulaire affiche « Les inscriptions ouvrent très bientôt » et n'envoie aucune donnée à un serveur de Velox Prestige, ni à un sous-traitant.</p>
      <p>${purpose} ${fields} ${duration} Ces règles s'appliqueront le jour où le stockage sera branché. ${rights}</p>
      <p>Le site est un ensemble de fichiers statiques servi par GitHub Pages. Il ne dépose pas de cookie et n'intègre aucun traceur tiers. L'hébergeur peut conserver des journaux techniques de connexion (adresse IP, horodatage, page demandée) pour faire fonctionner le service, selon sa propre politique. Velox Prestige n'exploite pas ces journaux.</p>`;
  }

  if (kind === "formspree") {
    return `
      <p>Les inscriptions sont ouvertes. Lorsque vous validez le formulaire, les données sont envoyées en HTTPS, au format JSON, vers Formspree (formspree.io), sous-traitant choisi par le responsable. Formspree les stocke et peut les transmettre par e-mail au responsable. Formspree, Inc. est établi aux États-Unis ; un transfert hors de l'Union européenne est donc possible, encadré par les clauses contractuelles types de Formspree. Leur politique : <a href="https://formspree.io/legal/privacy-policy" rel="noopener noreferrer">formspree.io/legal/privacy-policy</a>.</p>
      <p>${purpose} ${fields} ${duration} Le responsable s'engage à supprimer aussi les copies détenues chez Formspree dans ce délai, ou plus tôt sur demande. ${rights}</p>
      <p>Le site lui-même reste statique : GitHub Pages ne stocke pas les inscriptions. Aucun cookie ni traceur tiers n'est déposé par Velox Prestige.</p>`;
  }

  if (kind === "apps-script") {
    return `
      <p>Les inscriptions sont ouvertes. Lorsque vous validez le formulaire, les données sont envoyées en HTTPS vers un script Google Apps Script publié par le responsable, qui les ajoute à un tableur Google Sheets dont il est propriétaire. Google (Google Ireland Limited et, pour l'infrastructure, Google LLC) est sous-traitant. L'hébergement peut impliquer un transfert hors de l'Union européenne, encadré par les clauses contractuelles types de Google. Politique de Google : <a href="https://policies.google.com/privacy" rel="noopener noreferrer">policies.google.com/privacy</a>.</p>
      <p>Le navigateur ne peut pas lire la réponse du script (limitation technique de ce type d'adresse). Le site affiche donc une confirmation d'envoi lorsque la requête part sans erreur réseau, et un message d'échec si le réseau bloque l'envoi. En cas de doute, écrivez à l'adresse des mentions légales.</p>
      <p>${purpose} ${fields} ${duration} Le responsable supprime les lignes du tableur dans ce délai, ou plus tôt sur demande. ${rights}</p>
      <p>Le site lui-même reste statique : GitHub Pages ne stocke pas les inscriptions. Aucun cookie ni traceur tiers n'est déposé par Velox Prestige.</p>`;
  }

  let host = "le service configuré";
  try {
    host = new URL(url).host;
  } catch {
    host = "le service configuré";
  }
  return `
    <p>Les inscriptions sont ouvertes. Lorsque vous validez le formulaire, les données sont envoyées en HTTPS, au format JSON, vers l'adresse configurée par le responsable (hôte : ${escapeHtml(host)}). Cet hôte est le sous-traitant qui stocke les demandes. Si ce n'est ni Formspree ni un Google Apps Script, le responsable doit pouvoir préciser, sur simple demande, le nom du sous-traitant, le pays de stockage et les garanties de transfert.</p>
    <p>${purpose} ${fields} ${duration} ${rights}</p>
    <p>Le site lui-même reste statique : GitHub Pages ne stocke pas les inscriptions. Aucun cookie ni traceur tiers n'est déposé par Velox Prestige.</p>`;
}

function formNotice(kind) {
  if (kind === "none") {
    return `<p class="form-banner" id="form-banner">Les inscriptions ouvrent très bientôt. Tant que le stockage n'est pas branché, ce formulaire n'enregistre rien et n'envoie aucune donnée.</p>`;
  }
  if (kind === "formspree") {
    return `<p class="form-banner" id="form-banner">Votre demande est envoyée à Formspree, pour le seul compte de Velox Prestige, afin de vous informer du lancement. Détail dans la <a href="${base}/confidentialite.html">politique de confidentialité</a>.</p>`;
  }
  if (kind === "apps-script") {
    return `<p class="form-banner" id="form-banner">Votre demande est enregistrée dans un tableur Google Sheets du responsable, afin de vous informer du lancement. Détail dans la <a href="${base}/confidentialite.html">politique de confidentialité</a>.</p>`;
  }
  return `<p class="form-banner" id="form-banner">Votre demande est envoyée au service d'inscription configuré par le responsable, afin de vous informer du lancement. Détail dans la <a href="${base}/confidentialite.html">politique de confidentialité</a>.</p>`;
}

function placeholder(value, label) {
  const text = String(value || "").trim();
  if (text) return escapeHtml(text);
  return `<span class="placeholder">[${escapeHtml(label)}]</span>`;
}

function emailHtml(value) {
  const text = String(value || "").trim();
  if (!text) return `<span class="placeholder">[adresse e-mail à compléter]</span>`;
  return `<a href="mailto:${escapeHtml(text)}">${escapeHtml(text)}</a>`;
}

function detectProvider(url) {
  if (!url) return "none";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return "none";
  }
  if (host === "formspree.io" || host.endsWith(".formspree.io")) return "formspree";
  if (host === "script.google.com" || host.endsWith(".googleusercontent.com")) return "apps-script";
  return "custom";
}

function normalizeBase(value) {
  if (!value || value === "/") return "";
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.replace(/\/$/, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}
