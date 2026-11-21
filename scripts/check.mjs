import fs from "node:fs";
import path from "node:path";

const dist = path.resolve("dist");
const read = (file) => fs.readFileSync(path.join(dist, file), "utf8");
const config = JSON.parse(read("assets/js/config.js").replace("window.VELOX_CONFIG=", "").trim().replace(/;$/, ""));
const files = ["index.html", "tarifs.html", "liste-attente.html", "mentions-legales.html", "confidentialite.html", "credits.html", "404.html"];
const html = Object.fromEntries(files.map((file) => [file, read(file)]));
const all = Object.values(html).join("\n");
const failures = [];
const fail = (message) => failures.push(message);

for (const file of files) {
  if (!html[file].includes('lang="fr"')) fail(`${file} sans lang=fr`);
  if (!html[file].includes("<title>")) fail(`${file} sans title`);
  if (!html[file].includes('property="og:title"')) fail(`${file} sans Open Graph`);
  if (!html[file].includes('rel="canonical"')) fail(`${file} sans canonical`);
  if ((html[file].match(/<h1[\s>]/g) || []).length !== 1) fail(`${file} doit avoir un seul h1`);
}

const banned = [
  "2 400",
  "2400",
  "189 000",
  "2 450 000",
  "2 190 000",
  "veloxprestige.fr",
  "googletagmanager",
  "google-analytics",
  "gtag(",
  "facebook.net",
  "hotjar",
  "plausible",
  "cookieconsent",
  "Maison Auguste",
  "24 812",
  "Payer et publier",
  "checked",
];
for (const word of banned) {
  if (all.includes(word)) fail(`texte interdit présent : ${word}`);
}
if (/<script[^>]+src="https?:/i.test(all)) fail("script tiers détecté");
if (!html["liste-attente.html"].includes('type="checkbox"')) fail("case de consentement absente");
if (!html["liste-attente.html"].includes("data-honeypot")) fail("honeypot absent");
if (!html["mentions-legales.html"].includes("Ozen Yigit")) fail("responsable absent des mentions");
if (!html["mentions-legales.html"].includes("SIREN")) fail("SIREN absent");
if (!html["tarifs.html"].includes("19")) fail("premium 19 absent");
if (!html["tarifs.html"].includes("99")) fail("starter 99 absent");
if (!html["tarifs.html"].includes("249")) fail("pro 249 absent");
if (!html["tarifs.html"].includes("499")) fail("elite 499 absent");
if (!html["tarifs.html"].includes("12,90")) fail("Velox Plus mensuel absent");
if (!html["tarifs.html"].includes("129")) fail("Velox Plus annuel absent");
if (!html["index.html"].includes("Illustration")) fail("les visuels ne sont pas marqués comme illustrations");
if (!html["index.html"].includes("bientôt disponible") && !html["index.html"].includes("Bientôt disponible")) {
  fail("la recherche IA n'est pas présentée comme à venir");
}

if (!config.waitlistEndpoint) {
  if (!html["liste-attente.html"].includes("Les inscriptions ouvrent très bientôt")) {
    fail("message honnête absent alors qu'aucun endpoint n'est configuré");
  }
  if (!html["confidentialite.html"].includes("Aucune inscription n'est collectée")) {
    fail("la politique de confidentialité ne dit pas que rien n'est collecté");
  }
  if (html["confidentialite.html"].includes("Formspree") && html["confidentialite.html"].includes("sont ouvertes")) {
    fail("la politique décrit un stockage actif alors qu'aucun endpoint n'est configuré");
  }
} else if (!html["confidentialite.html"].includes("Les inscriptions sont ouvertes")) {
  fail("la politique ne décrit pas le stockage actif");
}

const assetRefs = all.match(/(?:href|src)="([^"]+)"/g) || [];
for (const ref of assetRefs) {
  const url = ref.slice(ref.indexOf('"') + 1, -1);
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("#")) continue;
  if (!url.includes("/assets/")) continue;
  const relative = url.replace(/^.*?\/assets\//, "assets/");
  if (!fs.existsSync(path.join(dist, relative.split("?")[0]))) fail(`fichier manquant : ${url}`);
}

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log(`Vérifications passées (${config.provider}, ${files.length} pages).`);
