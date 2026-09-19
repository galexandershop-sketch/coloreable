// tools/gen-seo.mjs — Nivel 3 + i18n: paginas estaticas por keyword (es + en) + sitemap.
// Uso: node tools/gen-seo.mjs
// Las imagenes se generan en el navegador al visitar (seo-page.js + lineart.js).
// Agregar idioma = entrada en LOCALES + tools/locales/xx.json (mismo orden que es).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// BASE: dominio canonico. Cambiar aqui cuando caiga el dominio propio.
const BASE = "https://coloreable.vercel.app";
const TODAY = new Date().toISOString().slice(0, 10);

function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ñ/g, "n").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const LOCALES = {
  es: {
    lang: "es", dir: "", og: "es_ES", hreflang: "es",
    art: /^(el|la|los|las|un|una)\s+/i,
    file: "tools/keywords.json",
    slug: (t) => "dibujos-de-" + slugify(t.replace(/^(el|la|los|las|un|una)\s+/i, "")) + "-para-colorear",
    title: (e) => `Dibujos de ${cap(e.t)} para colorear | 6 gratis para imprimir`,
    desc: (e) => `6 dibujos de ${e.t} para colorear gratis e imprimibles. Creados con IA, trazo grueso ideal para niños. Imprime o descarga sin registro.`,
    kw: (e) => `dibujos de ${e.t} para colorear, ${e.t} para imprimir, ${e.s} para colorear, dibujos infantiles, colorear gratis`,
    badge: "Gratis · Sin registro · Imprimible",
    sub: "6 dibujos únicos creados con IA. Imprime o descarga gratis.",
    home: "Inicio",
    h1: (e) => `Dibujos de ${cap(e.t)} para colorear`,
    printBtn: "Imprimir todo", dlBtn: "Descargar todo",
    howTitle: "¿Cómo usar estos dibujos?",
    more: "Más dibujos para colorear",
    mine: "✏️ Crear el mío con IA",
    made: "Dibujos con IA · Gratis para uso personal y educativo",
    priv: "Privacidad", terms: "Términos", contact: "Contacto",
    var6: ["", ", primer plano", ", con fondo simple", ", estilo tierno", ", escena divertida", ", con amigos"],
    paras(e, sibs, idx) {
      const sibTxt = sibs.slice(0, 3).map((x) => x.e.t).join(", ");
      const V = [
        "con trazo grueso, ideales para lápices, crayones y marcadores",
        "con líneas limpias y formas simples, pensados para manos pequeñas",
        "en blanco y negro, listos para darles color y vida",
      ][idx % 3];
      const U = [
        "Los más pequeños pueden pintar sin salirse, y los mayores tienen detalles para un buen rato de calma. Úsalos en casa, en clase o en fiestas infantiles.",
        "Son perfectos para la escuela, tardes de lluvia o viajes largos. Imprime varios y arma tu propia colección.",
        "Cada dibujo ayuda con la motricidad fina y la concentración, mientras se divierten. Un plan sin pantallas que nunca falla.",
      ][idx % 3];
      return [
        `¿Buscas dibujos de ${e.t} para colorear? Aquí tienes 6 dibujos de ${e.t} gratis, generados con inteligencia artificial solo para ti. Cada ${e.s} para colorear viene ${V}. Sin registro y sin costo: elige tu favorito, imprímelo y a colorear.`,
        `Todos estos dibujos de ${e.t} para imprimir están pensados para niños: ${U}`,
        `Colorear ${e.t} es facilísimo: espera unos segundos a que se creen los 6 dibujos, toca Imprimir todo para sacarlos en tamaño carta o A4, o Descargar todo para guardarlos en tu celular o computador. Consejo de profe: imprime 2 por hoja para ahorrar papel.`,
        `¿Quieres más ideas? También tenemos dibujos de ${sibTxt} para colorear, y cientos de temas en la página principal. Cada dibujo es único: si quieres otra versión, entra a Colorable, escribe lo que imagines y créala en segundos.`,
      ];
    },
    steps: (e) => [
      `Espera unos segundos a que se creen los 6 dibujos de ${e.t}.`,
      "Imprime en carta o A4, o descarga el paquete ZIP.",
      "Colorea con lápices, crayones o marcadores. ¡A crear!",
    ],
    ui: {
      creating: "Creando tus dibujos... (unos segundos)",
      partial: "Listo: {ok} dibujos. ({fail} fallaron, dale Reintentar)",
      wait: "Aún no hay dibujos listos, espera unos segundos.",
      unreadable: "No se pudieron leer los dibujos.",
      print_wait: "Preparando hoja de impresión...",
      print_fail: "No se pudo abrir la impresión.",
      zip_build: "Armando ZIP con {n} dibujos...",
      zip_done: "ZIP listo en tu carpeta de descargas.",
      dl_one: "Descargando uno por uno...",
      dl_done: "Descarga lista: {n} dibujos.",
      creating_one: "Creando dibujo...",
      drawing_n: "Dibujo {n} de {t} para colorear",
      retry: "Reintentar",
      again: "🔄 Otra versión",
      fail_hint: "Falló: dale a 🔄 Otra versión.",
      img_alt: "Dibujo {n} para colorear",
      print_1: "Imprimir dibujo",
      print_n: "Imprimir {n} dibujos",
      size_title: "Tamaño",
      size_full: "Página completa (1 por hoja)",
      size_half: "Media página (2 por hoja)",
      size_quad: "Pequeños (4 por hoja)",
      tip: "Tip: en la ventana de impresión desactiva “Encabezados y pies de página” para que no salgan fecha ni dirección web.",
      cancel: "Cancelar",
      print: "Imprimir",
    },
  },
  en: {
    lang: "en", dir: "en", og: "en_US", hreflang: "en",
    file: "tools/locales/en.json",
    slug: (t) => slugify(t.replace(/^the\s+/i, "")) + "-coloring-pages",
    title: (e) => `${e.t} Coloring Pages | 6 Free Printables`,
    desc: (e) => `6 free printable ${e.t.toLowerCase()} coloring pages. AI-generated with bold outlines perfect for kids. Print or download, no signup.`,
    kw: (e) => `${e.t.toLowerCase()} coloring pages, printable ${e.t.toLowerCase()}, free coloring pages for kids`,
    badge: "Free · No Signup · Printable",
    sub: "6 unique AI-generated drawings. Print or download free.",
    home: "Home",
    h1: (e) => `${e.t} Coloring Pages`,
    printBtn: "Print all", dlBtn: "Download all",
    howTitle: "How to use these pages?",
    more: "More coloring pages",
    mine: "✏️ Create mine with AI",
    made: "AI drawings · Free for personal and educational use",
    priv: "Privacy", terms: "Terms", contact: "Contact",
    var6: ["", ", close-up", ", simple background", ", cute style", ", fun scene", ", with friends"],
    paras(e, sibs, idx) {
      const sibTxt = sibs.slice(0, 3).map((x) => x.e.t).join(", ");
      const V = [
        "with bold outlines, perfect for pencils, crayons and markers",
        "with clean lines and simple shapes, made for little hands",
        "in black and white, ready to bring to life with color",
      ][idx % 3];
      const U = [
        "Little ones can color without going over the lines, and older kids get details for a long calm moment. Use them at home, in class or at parties.",
        "They are perfect for school, rainy afternoons or long trips. Print several and build your own collection.",
        "Each page helps fine motor skills and focus while having fun. A no-screens plan that never fails.",
      ][idx % 3];
      return [
        `Looking for ${e.t.toLowerCase()} coloring pages? Here are 6 free ${e.t.toLowerCase()}, AI-generated just for you. Each page comes ${V}. No signup, no cost: pick your favorite, print it and start coloring.`,
        `All these printable ${e.t.toLowerCase()} are designed for kids: ${U}`,
        `Coloring ${e.t.toLowerCase()} is super easy: wait a few seconds while the 6 pages are created, hit Print all for letter or A4 size, or Download all to save them to your phone or computer. Teacher tip: print 2 per page to save paper.`,
        `Want more ideas? We also have ${sibTxt} coloring pages, and hundreds of topics on the main page. Every drawing is unique: for another version, visit Colorable, type what you imagine and create it in seconds.`,
      ];
    },
    steps: (e) => [
      `Wait a few seconds while the 6 ${e.t.toLowerCase()} pages are created.`,
      "Print on letter or A4, or download the ZIP pack.",
      "Color with pencils, crayons or markers. Let's create!",
    ],
    ui: {
      creating: "Creating your pages... (a few seconds)",
      partial: "Done: {ok} pages. ({fail} failed, hit Retry)",
      wait: "No pages ready yet, wait a few seconds.",
      unreadable: "Could not read the drawings.",
      print_wait: "Preparing print sheet...",
      print_fail: "Could not open printing.",
      zip_build: "Building ZIP with {n} pages...",
      zip_done: "ZIP ready in your downloads folder.",
      dl_one: "Downloading one by one...",
      dl_done: "Download ready: {n} pages.",
      creating_one: "Creating drawing...",
      drawing_n: "Drawing {n} of {t} coloring page",
      retry: "Retry",
      again: "🔄 Another version",
      fail_hint: "Failed: hit 🔄 Another version.",
      img_alt: "Coloring page {n}",
      print_1: "Print drawing",
      print_n: "Print {n} drawings",
      size_title: "Size",
      size_full: "Full page (1 per sheet)",
      size_half: "Half page (2 per sheet)",
      size_quad: "Small (4 per sheet)",
      tip: "Tip: in the print window turn off “Headers and footers” so no date or URL shows.",
      cancel: "Cancel",
      print: "Print",
    },
  },
};

function pageHTML(L, e, slug, sibs, idx, altHref) {
  const url = BASE + (L.dir ? "/" + L.dir : "") + "/" + slug + "/";
  const title = L.title(e);
  const desc = L.desc(e);
  const paras = L.paras(e, sibs, idx);
  const prompts = L.var6.map((v) => (e.p + v).trim());
  const ui = L.ui;
  const data = JSON.stringify({ topic: e.t, slug, prompts, ui }).replace(/</g, "\\u003c");
  const items = prompts.map((p, n) => `    {"@type":"ListItem","position":${n + 1},"item":{"@type":"CreativeWork","name":${JSON.stringify("Drawing " + (n + 1) + " " + e.t)},"text":${JSON.stringify(p)}}}`).join(",\n");
  const figs = prompts.map((p, n) => `      <figure><canvas id="seo-cv-${n}" width="0" height="0"></canvas><figcaption>${esc(ui.creating_one)}</figcaption><button type="button" class="btn-mini alt seo-again" data-i="${n}">${esc(ui.again)}</button></figure>`).join("\n");
  const sibLinks = sibs.map((x) => `        <a href="/${L.dir ? L.dir + "/" : ""}${x.slug}/">${esc(x.e.t)}</a>`).join("\n");
  const steps = L.steps(e).map((s) => `      <li>${esc(s)}</li>`).join("\n");
  const hreflang = altHref
    ? `<link rel="alternate" hreflang="${L.hreflang}" href="${url}">\n<link rel="alternate" hreflang="${L.hreflang === "es" ? "en" : "es"}" href="${altHref}">\n<link rel="alternate" hreflang="x-default" href="${BASE}/">`
    : `<link rel="alternate" hreflang="${L.hreflang}" href="${url}">`;
  return `<!DOCTYPE html>
<html lang="${L.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="keywords" content="${esc(L.kw(e))}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
${hreflang}
<meta property="og:type" content="website">
<meta property="og:locale" content="${L.og}">
<meta property="og:site_name" content="Colorable">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🖍️</text></svg>">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"CollectionPage","name":${JSON.stringify(title)},"description":${JSON.stringify(desc)},"url":${JSON.stringify(url)},"inLanguage":${JSON.stringify(L.lang)},"isPartOf":{"@type":"WebSite","name":"Colorable","url":${JSON.stringify(BASE + "/")}}, "mainEntity":{"@type":"ItemList","numberOfItems":6,"itemListElement":[
${items}
]}}</script>
<link rel="stylesheet" href="/style.css?v=7">
</head>
<body>
<header class="hero">
  <div class="hero-badge">${esc(L.badge)}</div>
  <h1>${esc(L.h1(e))}</h1>
  <p class="sub">${esc(L.sub)}</p>
</header>
<main class="card">
  <nav class="crumb"><a href="/${L.dir ? L.dir + "/" : ""}">${esc(L.home)}</a> · ${esc(e.t)}</nav>
${paras.map((p) => `  <p>${esc(p)}</p>`).join("\n")}
  <div class="row wrap" style="margin:12px 0">
    <button id="seo-print" class="btn-primary">${esc(L.printBtn)}</button>
    <button id="seo-dl" class="btn-ghost">${esc(L.dlBtn)}</button>
  </div>
  <div id="seo-status" role="status"></div>
  <section id="seo-grid">
${figs}
  </section>
  <h2 class="seo-h2">${esc(L.howTitle)}</h2>
  <ol>
${steps}
  </ol>
  <h2 class="seo-h2">${esc(L.more)}</h2>
  <nav class="cats">
${sibLinks}
        <a href="/">${esc(L.mine)}</a>
  </nav>
</main>
<footer>
  <p>${esc(L.made)}</p>
  <nav><a href="/privacy.html">${esc(L.priv)}</a><a href="/terminos.html">${esc(L.terms)}</a><a href="/contacto.html">${esc(L.contact)}</a></nav>
</footer>
<script type="application/json" id="seo-data">${data}</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="/lineart.js?v=1"></script>
<script src="/seo-page.js?v=3"></script>
</body>
</html>
`;
}

function hubHTML(L, all) {
  const url = BASE + (L.dir ? "/" + L.dir : "") + "/";
  const title = L.lang === "en" ? "Free Printable Coloring Pages | Colorable" : "Colorable";
  const h1 = L.lang === "en" ? "Free Printable Coloring Pages" : "Colorable";
  const cats = {};
  all.forEach((x) => { (cats[x.e.c] = cats[x.e.c] || []).push(x); });
  const groups = Object.keys(cats).sort().map((c) => {
    const links = cats[c].map((x) => `        <a href="/${L.dir ? L.dir + "/" : ""}${x.slug}/">${esc(x.e.t)}</a>`).join("\n");
    return `    <h2 class="seo-h2">${esc(cap(c))}</h2>\n    <nav class="cats">\n${links}\n    </nav>`;
  }).join("\n");
  const homeLink = L.dir ? `    <p><a href="/">${esc(LOCALES.es.home)} / Home</a></p>` : "";
  return `<!DOCTYPE html>
<html lang="${L.lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="robots" content="index, follow">
<link rel="canonical" href="${url}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🖍️</text></svg>">
<link rel="stylesheet" href="/style.css?v=7">
</head>
<body>
<header class="hero">
  <div class="hero-badge">${esc(L.badge)}</div>
  <h1>${esc(h1)}</h1>
  <p class="sub">${esc(L.sub)}</p>
</header>
<main class="card">
${groups}
${homeLink}
</main>
</body>
</html>
`;
}

// Carga y valida locales (mismo orden y cantidad que es).
const esList = JSON.parse(readFileSync(join(ROOT, LOCALES.es.file), "utf8"));
const DATA = { es: esList.map((e) => ({ ...e, slug: LOCALES.es.slug(e.t) })) };
for (const code of Object.keys(LOCALES)) {
  if (code === "es") continue;
  const list = JSON.parse(readFileSync(join(ROOT, LOCALES[code].file), "utf8"));
  if (list.length !== esList.length) throw new Error(code + ": " + list.length + " keywords, es tiene " + esList.length);
  DATA[code] = list.map((e) => ({ ...e, slug: LOCALES[code].slug(e.t) }));
}
const seen = new Set();
for (const code of Object.keys(DATA)) for (const e of DATA[code]) {
  const key = code + ":" + e.slug;
  if (seen.has(key)) throw new Error("slug duplicado: " + key);
  seen.add(key);
}

let count = 0;
for (const code of Object.keys(DATA)) {
  const L = LOCALES[code];
  DATA[code].forEach((e, idx) => {
    const sibs = DATA[code].filter((x) => x.c === e.c && x.slug !== e.slug).slice(0, 8)
      .map((x) => ({ slug: x.slug, e: { t: x.t, s: x.s, p: x.p, c: x.c } }));
    const alt = code === "es"
      ? BASE + "/en/" + DATA.en[idx].slug + "/"
      : BASE + "/" + DATA.es[idx].slug + "/";
    const dir = join(ROOT, L.dir, e.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), pageHTML(L, { t: e.t, s: e.s, p: e.p, c: e.c }, e.slug, sibs, idx, alt));
    count++;
  });
  if (L.dir) {
    const dir = join(ROOT, L.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), hubHTML(L, DATA[code].map((x) => ({ slug: x.slug, e: { t: x.t, c: x.c } }))));
    count++;
  }
}

// Sitemap: home + hub en + 200 paginas + legales.
const urls = [
  { loc: BASE + "/", freq: "daily", pri: "1.0" },
  { loc: BASE + "/en/", freq: "weekly", pri: "0.9" },
  ...DATA.es.map((e) => ({ loc: `${BASE}/${e.slug}/`, freq: "weekly", pri: "0.8" })),
  ...DATA.en.map((e) => ({ loc: `${BASE}/en/${e.slug}/`, freq: "weekly", pri: "0.8" })),
  { loc: BASE + "/privacy.html", freq: "yearly", pri: "0.3" },
  { loc: BASE + "/terminos.html", freq: "yearly", pri: "0.3" },
  { loc: BASE + "/contacto.html", freq: "yearly", pri: "0.3" },
];
writeFileSync(join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.pri}</priority>\n  </url>`).join("\n") +
  `\n</urlset>\n`);

console.log(`OK: ${count} paginas (${Object.keys(DATA).map((c) => c + ":" + DATA[c].length).join(", ")}) + sitemap (${urls.length} urls) — ${TODAY}`);
