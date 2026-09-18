// tools/gen-seo.mjs — Nivel 3: genera 100 paginas estaticas por keyword + sitemap.
// Uso: node tools/gen-seo.mjs
// Las imagenes se generan en el navegador al visitar (seo-page.js + lineart.js).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// BASE: dominio canonico. Cambiar aqui cuando caiga el dominio propio.
const BASE = "https://coloreable.vercel.app";
const TODAY = new Date().toISOString().slice(0, 10);

const ART = /^(el|la|los|las|un|una)\s+/i;
function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function slugFor(t) {
  return "dibujos-de-" + slugify(t.replace(ART, "")) + "-para-colorear";
}
function deT(t) {
  // "de el sistema solar" -> "del sistema solar"
  return ("de " + t).replace(/^de el /i, "del ");
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const VAR = [
  "con trazo grueso, ideales para lápices, crayones y marcadores",
  "con líneas limpias y formas simples, pensados para manos pequeñas",
  "en blanco y negro, listos para darles color y vida",
];
const USE = [
  "Los más pequeños pueden pintar sin salirse, y los mayores tienen detalles para un buen rato de calma. Úsalos en casa, en clase o en fiestas infantiles.",
  "Son perfectos para la escuela, tardes de lluvia o viajes largos. Imprime varios y arma tu propia colección.",
  "Cada dibujo ayuda con la motricidad fina y la concentración, mientras se divierten. Un plan sin pantallas que nunca falla.",
];

function paragraphs(e, sibs, idx) {
  const t = e.t, s = e.s, v = VAR[idx % VAR.length], u = USE[idx % USE.length];
  const sibTxt = sibs.slice(0, 3).map((x) => x.t).join(", ");
  return [
    `¿Buscas dibujos de ${t} para colorear? Aquí tienes 6 dibujos de ${t} gratis, generados con inteligencia artificial solo para ti. Cada ${s} para colorear viene ${v}. Sin registro y sin costo: elige tu favorito, imprímelo y a colorear.`,
    `Todos estos dibujos de ${t} para imprimir están pensados para niños: ${u}`,
    `Colorear ${t} es facilísimo: espera unos segundos a que se creen los 6 dibujos, toca Imprimir todo para sacarlos en tamaño carta o A4, o Descargar todo para guardarlos en tu celular o computador. Consejo de profe: imprime 2 por hoja para ahorrar papel.`,
    `¿Quieres más ideas? También tenemos dibujos de ${sibTxt} para colorear, y cientos de temas en la página principal. Cada dibujo es único: si quieres otra versión, entra a Colorable, escribe lo que imagines y créala en segundos.`,
  ];
}

function pageHTML(e, slug, sibs, idx) {
  const title = `Dibujos de ${cap(e.t)} para colorear | 6 gratis para imprimir`;
  const desc = `6 dibujos de ${e.t} para colorear gratis e imprimibles. Creados con IA, trazo grueso ideal para niños. Imprime o descarga sin registro.`;
  const url = BASE + "/" + slug + "/";
  const paras = paragraphs(e, sibs.length ? sibs : [{ t: "animales" }, { t: "princesas" }, { t: "vehículos" }], idx);
  const VAR6 = ["", ", primer plano", ", con fondo simple", ", estilo tierno", ", escena divertida", ", con amigos"];
  const prompts = VAR6.map((v) => (e.p + v).trim());
  const data = JSON.stringify({ topic: e.t, slug, prompts }).replace(/</g, "\\u003c");
  const items = prompts.map((p, n) => `    {"@type":"ListItem","position":${n + 1},"item":{"@type":"CreativeWork","name":"Dibujo ${n + 1} de ${esc(e.t)} para colorear","text":${JSON.stringify(p)}}}`).join(",\n");
  const figs = prompts.map((p, n) => `      <figure><canvas id="seo-cv-${n}" width="0" height="0"></canvas><figcaption>Creando dibujo ${n + 1}...</figcaption><button type="button" class="btn-mini alt seo-again" data-i="${n}">🔄 Otra versión</button></figure>`).join("\n");
  const sibLinks = sibs.map((x) => `        <a href="/${x.slug}/">Dibujos de ${esc(x.t)}</a>`).join("\n");
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="dibujos de ${esc(e.t)} para colorear, ${esc(e.t)} para imprimir, ${esc(e.s)} para colorear, dibujos infantiles, colorear gratis">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:locale" content="es_ES">
<meta property="og:site_name" content="Colorable">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🖍️</text></svg>">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"CollectionPage","name":${JSON.stringify(title)},"description":${JSON.stringify(desc)},"url":${JSON.stringify(url)},"inLanguage":"es","isPartOf":{"@type":"WebSite","name":"Colorable","url":${JSON.stringify(BASE + "/")}}, "mainEntity":{"@type":"ItemList","numberOfItems":6,"itemListElement":[
${items}
]}}</script>
<link rel="stylesheet" href="/style.css?v=7">
</head>
<body>
<header class="hero">
  <div class="hero-badge">Gratis · Sin registro · Imprimible</div>
  <h1>Dibujos de ${esc(cap(e.t))} para colorear</h1>
  <p class="sub">6 dibujos únicos creados con IA. Imprime o descarga gratis.</p>
</header>
<main class="card">
  <nav class="crumb"><a href="/">Inicio</a> · Dibujos de ${esc(e.t)}</nav>
  ${paras.map((p) => `  <p>${esc(p)}</p>`).join("\n")}
  <div class="row wrap" style="margin:12px 0">
    <button id="seo-print" class="btn-primary">Imprimir todo</button>
    <button id="seo-dl" class="btn-ghost">Descargar todo</button>
  </div>
  <div id="seo-status" role="status"></div>
  <section id="seo-grid">
${figs}
  </section>
  <h2 class="seo-h2">¿Cómo usar estos dibujos?</h2>
  <ol>
    <li><strong>Espera</strong> unos segundos a que se creen los 6 dibujos de ${esc(e.t)}.</li>
    <li><strong>Imprime</strong> en carta o A4, o <strong>descarga</strong> el paquete ZIP.</li>
    <li><strong>Colorea</strong> con lápices, crayones o marcadores. ¡A crear!</li>
  </ol>
  <h2 class="seo-h2">Más dibujos para colorear</h2>
  <nav class="cats">
${sibLinks}
        <a href="/">✏️ Crear el mío con IA</a>
  </nav>
</main>
<footer>
  <p>Dibujos con IA · Gratis para uso personal y educativo</p>
  <nav><a href="/privacy.html">Privacidad</a><a href="/terminos.html">Términos</a><a href="/contacto.html">Contacto</a></nav>
</footer>
<script type="application/json" id="seo-data">${data}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="/lineart.js?v=1"></script>
<script src="/seo-page.js?v=2"></script>
</body>
</html>
`;
}

const keywords = JSON.parse(readFileSync(join(ROOT, "tools", "keywords.json"), "utf8"));
const withSlugs = keywords.map((e) => ({ ...e, slug: slugFor(e.t) }));
// Duplicados de slug = canibalizacion: fallar fuerte.
const seen = new Set();
for (const e of withSlugs) {
  if (seen.has(e.slug)) throw new Error("slug duplicado: " + e.slug);
  seen.add(e.slug);
}
let count = 0;
withSlugs.forEach((e, idx) => {
  const sibs = withSlugs.filter((x) => x.c === e.c && x.slug !== e.slug).slice(0, 8);
  const dir = join(ROOT, e.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), pageHTML(e, e.slug, sibs, idx));
  count++;
});

// Sitemap: home + 100 paginas + legales.
const urls = [
  { loc: BASE + "/", freq: "daily", pri: "1.0" },
  ...withSlugs.map((e) => ({ loc: `${BASE}/${e.slug}/`, freq: "weekly", pri: "0.8" })),
  { loc: BASE + "/privacy.html", freq: "yearly", pri: "0.3" },
  { loc: BASE + "/terminos.html", freq: "yearly", pri: "0.3" },
  { loc: BASE + "/contacto.html", freq: "yearly", pri: "0.3" },
];
writeFileSync(join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`).join("\n") +
  `\n</urlset>\n`);

// Hub para la home (12 top): se imprime para pegarlo una vez en index.html.
const TOP = ["dinosaurios", "princesas", "gatos", "superhéroes", "navidad", "halloween", "perros", "flores", "fútbol", "cohetes", "delfines", "robots"];
const hub = TOP.map((t) => {
  const e = withSlugs.find((x) => x.t === t);
  return e ? `    <a href="/${e.slug}/">Dibujos de ${e.t}</a>` : null;
}).filter(Boolean).join("\n");
writeFileSync(join(ROOT, "tools", "hub-snippet.html"), `<nav class="cats" id="seocats">\n${hub}\n</nav>\n`);
console.log(`OK: ${count} paginas + sitemap (${urls.length} urls) + hub (${TOP.length} links) — ${TODAY}`);
