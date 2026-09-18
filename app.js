const API = "https://death-image.ashlynn.workers.dev/generate";
const COMPARE_RAW = false; // TEMP-DIAG paso 1: cruda API vs line-art lado a lado. Quitar antes de produccion.
const $ = id => document.getElementById(id);
const IDEAS = ["dinosaurio con casco de astronauta","unicornio saltando sobre el arcoiris","gato pirata con parche y cofre del tesoro","dragon bebe lanzando fuego","cohete volando a la luna con estrellas","perro bombero con manguera y casco","castillo de princesa con torres y banderas","tiburon surfeando una ola gigante","robot amigable saludando","mariposa gigante con alas decoradas","dinosaurio astronauta","unicornio entre nubes","gato pirata","dragon bebe","cohete a la luna","perro bombero","castillo de princesa","tiburon surfista","robot amigable","mariposa gigante","camion de bomberos","sirena en el mar"];
const CATS = [
  { t: "dinosaurios", p: "dinosaurio bebe tierno jugando en la selva" },
  { t: "unicornios", p: "unicornio saltando sobre el arcoiris" },
  { t: "animales", p: "animales tiernos del bosque reunidos" },
  { t: "princesas", p: "princesa con vestido y corona en su castillo" },
  { t: "superheroes", p: "superheroe volando sobre la ciudad" },
  { t: "vehiculos", p: "camion de bomberos con escalera" },
  { t: "navidad", p: "arbol de navidad con regalos y estrella" },
  { t: "halloween", p: "calabaza de halloween con sombrero de bruja" },
  { t: "espacio", p: "cohete volando a la luna con estrellas" },
  { t: "oceano", p: "tiburon amigable con peces y corales" },
  { t: "granja", p: "vaca y pollito en la granja" },
  { t: "profesiones", p: "bombero con manguera apagando fuego" }
];
function status(m, err) { const s = $("status"); s.textContent = m; s.className = err ? "err" : ""; }
$("steps").oninput = () => { $("stepsVal").textContent = $("steps").value; };
$("chips").innerHTML = IDEAS.slice(0, 8).map(i => '<button class="chip">' + i + '</button>').join("");
$("chips").onclick = e => { if (e.target.classList.contains("chip")) { $("prompt").value = e.target.textContent; gen(); } };
$("cats").innerHTML = CATS.map((c, i) => '<button data-i="' + i + '">dibujos de ' + c.t + ' para colorear</button>').join("");
$("cats").onclick = async e => {
  const b = e.target.closest ? e.target.closest("button") : null;
  if (!b || b.disabled || b.getAttribute("data-i") === null) return;
  const c = CATS[+b.getAttribute("data-i")];
  if (!c) return;
  const old = b.textContent; b.disabled = true; b.textContent = "Generando...";
  $("prompt").value = c.p; // prompt rico y especifico, no el sustantivo generico
  $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  try { await gen(); } finally { b.disabled = false; b.textContent = old; }
};
$("surprise").onclick = () => { $("prompt").value = IDEAS[Math.floor(Math.random() * IDEAS.length)]; gen(); };
let made = parseInt(localStorage.getItem("made") || "0");
const paintCount = () => { $("count-made").textContent = made ? (made + " dibujos creados") : ""; };
paintCount();
const VEHICLES = ["avion","avioneta","cohete","carro","coche","auto","barco","buque","tren","tractor","camion","camioneta","moto","bicicleta","helicoptero","submarino","globo","crucero"];
const PLACES = ["castillo","casa","edificio","iglesia","puente","faro","molino","planeta","luna","sol","arbol","flor","montana","granja","playa","bosque","ciudad","parque","escuela","hospital"];
function norm(s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
// Escape para interpolar texto de usuario en HTML (evita XSS via <img onerror=...>).
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
// Palabras de estilo que PELEAN con la receta (el modelo las obedece y arruina el
// dibujo para colorear). Se quitan en silencio; la receta ya fija el estilo.
const BAD_STYLE = new Set(["realistic","realista","realistas","photorealistic","fotorrealista","fotorrealistas","detailed","detallado","detallada","detallados","detalladas","shaded","sombreado","sombreada","sombreados","sombreadas","3d","render","photography","fotografia","photo","foto","fotos","hyperrealistic","cinematic","acuarela","watercolor","oleo","colorful","color","colores","gris","grises","oscuro","oscura","oscuros","oscuras","neon","brillante"]);
// Conceptos abstractos que el modelo no sabe dibujar -> escena concreta.
const ABSTRACTS = { "amor": "corazon grande con brillos", "amistad": "dos amigos abrazandose", "familia": "familia feliz junta", "paz": "paloma blanca con rama de olivo", "felicidad": "ninos riendo y jugando", "cumpleanos": "pastel con velas y globos", "fiesta": "fiesta con globos y guirnaldas", "noche": "luna llena y estrellas en el cielo", "verano": "sol playa y mar", "invierno": "muneco de nieve con bufanda", "primavera": "flores y mariposas en el campo", "otono": "arbol con hojas caidas", "navidad": "arbol de navidad con regalos y estrella", "halloween": "calabaza con sombrero de bruja", "pascua": "huevos de pascua decorados", "circo": "carpa de circo con payaso", "zoologico": "leon y elefante", "musica": "notas musicales e instrumentos", "futbol": "balon de futbol en la cancha", "escuela": "escuela con ninos y libros", "selva": "leon entre palmeras", "desierto": "cactus y sol en el desierto" };
function sanitizePrompt(raw) {
  let t = (raw || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, " ");
  t = t.replace(/\s+/g, " ").trim().replace(/^[.,;:!?¿¡]+|[.,;:!?¿¡]+$/g, "").trim();
  if (!t) return "";
  // quitar bigramas anti-estilo ("a color", "en colores"...) y palabras sueltas
  const toks = t.split(" ");
  const keep = [];
  for (let i = 0; i < toks.length; i++) {
    const a = norm(toks[i]);
    const b = i + 1 < toks.length ? norm(toks[i + 1]) : "";
    if ((a === "a" || a === "en" || a === "de") && (b === "color" || b === "colores")) { i++; continue; }
    if (BAD_STYLE.has(a)) continue;
    keep.push(toks[i]);
  }
  t = keep.join(" ").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length > 140) { // URLs GET y la API agradecen prompts acotados
    const cut = t.slice(0, 140);
    const sp = cut.lastIndexOf(" ");
    t = (sp > 40 ? cut.slice(0, sp) : cut).trim();
  }
  return t;
}
function coloringPrompt(user) {
  // Prompt muy simple ("dinosaurio", "avion") = resultado mediocre. Si trae menos
  // de 4 palabras se enriquece solo, con escena segun categoria: personajes sonrien,
  // vehiculos de lado, lugares como composicion. "smiling character" a un avion salia raro.
  const words = user.split(/\s+/).filter(Boolean);
  let topic = user;
  // 1) Abstractos -> escena concreta ("amor" solo no se puede dibujar).
  const low0 = " " + norm(user) + " ";
  for (const k in ABSTRACTS) {
    if (low0.indexOf(" " + k + " ") !== -1) { topic = user + ", " + ABSTRACTS[k]; break; }
  }
  // 2) Recuento sobre el tema ya concretado.
  const n = topic.split(/\s+/).filter(Boolean).length;
  let scene = "";
  if (n < 4) {
    const low = norm(topic);
    const has = (list) => list.some((w) => low.includes(w));
    if (has(VEHICLES)) scene = ", simple vehicle, side view, clear shapes";
    else if (has(PLACES)) scene = ", simple composition, clear shapes";
    else scene = ", cute happy character, simple scene, smiling";
  }
  return "coloring book page, " + topic + scene + ", black and white line art, bold outlines, thick lines, no shading, no gray, no color, white background, simple shapes, minimalist, centered, full page, for kids";
}
async function gen() {
  const btn = $("gen");
  const raw = $("prompt").value.trim();
  if (!raw) { status("Escribe que quieres colorear.", true); return; }
  const retryBtn = $("retry");
  btn.disabled = true; retryBtn.disabled = true;
  // Limpieza inmediata: al generar, lo viejo se quita y se muestra "generando".
  $("result").innerHTML = '<div class="skel"></div>';
  try {
    const clean = sanitizePrompt(raw) || "gato tierno"; // blindaje: emojis, anti-estilo, largos
    const baseParams = { prompt: coloringPrompt(clean), image: $("count").value, dimensions: $("ratio").value, steps: $("steps").value, safety: "true" };
    const imgs = await generateWithRetry(baseParams, (m) => status(m));
    status("");
    const tmp = document.createElement("div"); // montaje en borrador: se publica solo si TODO sale bien
    for (const u of imgs) {
      await processImage(raw, u, tmp);
    }
    // Publicar atomico: exito -> la galeria nueva reemplaza a la anterior.
    $("result").innerHTML = "";
    while (tmp.firstChild) $("result").appendChild(tmp.firstChild);
    made += imgs.length;
    localStorage.setItem("made", made);
    paintCount();
  } catch (e) { showGenError("No se pudo crear el dibujo. " + friendlyGenError(e)); }
  finally { btn.disabled = false; retryBtn.disabled = false; }
}
// Marca el titulo si el line-art salio flojo. Reusada al crear y al regenerar.
function tagQuality(card, q) {
  if (typeof q === "number" && (q < 0.008 || q > 0.35)) {
    const h = card.querySelector("h3");
    if (h && h.textContent.indexOf("lineas flojas") === -1) h.textContent += " (lineas flojas: regenera)";
  }
}
// Crea la tarjeta de UN dibujo (canvas + botones + line-art + pintor).
// Reusada por gen() y por el modo docente masivo. host = contenedor destino.
// opts.paint === false -> sin boton Colorear (modo aula: solo imprimir/descargar).
async function processImage(raw, u, host, opts) {
  opts = opts || {};
  const bold = $("style").value === "bold";
  const card = document.createElement("div");
  card.className = "page";
  card.innerHTML = "<h3>" + esc(String(raw).slice(0, 40)) + "</h3>";
  const cv = document.createElement("canvas");
  if (COMPARE_RAW) {
    // TEMP-DIAG: (a) cruda tal cual la devuelve la API | (b) canvas tras paintLineArt().
    const comp = document.createElement("div");
    comp.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start";
    const figA = document.createElement("figure");
    figA.style.margin = "0";
    const rawImg = document.createElement("img");
    rawImg.src = u;
    rawImg.alt = "cruda API";
    rawImg.style.width = "100%";
    const capA = document.createElement("figcaption");
    capA.textContent = "(a) cruda API";
    capA.style.fontSize = ".8rem";
    figA.append(rawImg, capA);
    const figB = document.createElement("figure");
    figB.style.margin = "0";
    const capB = document.createElement("figcaption");
    capB.textContent = "(b) tras paintLineArt";
    capB.style.fontSize = ".8rem";
    figB.append(cv, capB);
    comp.append(figA, figB);
    card.appendChild(comp);
  } else {
    card.appendChild(cv);
  }
  const row = document.createElement("div");
  row.className = "actions";
  const bPrint = document.createElement("button"); bPrint.className = "btn-mini"; bPrint.textContent = "Imprimir";
  const bDown = document.createElement("button"); bDown.className = "btn-mini alt"; bDown.textContent = "Descargar";
  const bPaint = document.createElement("button"); bPaint.className = "btn-mini alt"; bPaint.textContent = "Colorear aqui";
  const bRetry = document.createElement("button"); bRetry.className = "btn-mini alt"; bRetry.textContent = "Otra version";
  if (opts.paint !== false) {
    bPaint.disabled = true; bPaint.textContent = "Preparando...";
    row.append(bPrint, bDown, bPaint, bRetry);
  } else {
    row.append(bPrint, bDown, bRetry);
  }
  card.appendChild(row);
  host.appendChild(card);
  // Handlers ANTES del line-art: si el usuario clica rapido, el boton ya responde.
  bPrint.onclick = () => printOne(cv);
  bDown.onclick = () => downloadOne(cv);
  bPaint.onclick = () => {
    if (!bPaint || bPaint.dataset.on || bPaint.disabled) return;
    bPaint.dataset.on = "1";
    bPaint.textContent = "Coloreando...";
    let ok = null;
    try { ok = attachPainter(cv); } catch (err) { ok = null; }
    if (ok) { bPaint.textContent = "Listo para pintar"; }
    else { delete bPaint.dataset.on; bPaint.textContent = "Colorear aqui"; status("No se pudo activar el modo pintar.", true); }
  };
  await lineArt(u, cv, bold, raw).then(q => tagQuality(card, q));
  // Solo sincronizar pintor si esta tarjeta tiene modo pintar (bulk no lo tiene:
  // sin este resguardo tocaria la capa de OTRA tarjeta).
  if (bPaint && bPaint.dataset.on && window.syncPainterSize) {
    try { window.syncPainterSize(cv); } catch (e) {}
  }
  if (bPaint) { bPaint.disabled = false; bPaint.textContent = "Colorear aqui"; }
  bRetry.onclick = async () => {
    // Regenera SOLO esta tarjeta con el mismo tema (vale para paquete y unitario).
    if (bRetry.disabled) return;
    bRetry.disabled = true;
    const oldT = bRetry.textContent; bRetry.textContent = "...";
    // Velo "Generando..." sobre la tarjeta mientras llega la nueva version.
    card.style.position = "relative";
    const veil = document.createElement("div");
    veil.textContent = "Generando...";
    veil.style.cssText = "position:absolute;inset:0;background:rgba(255,248,240,.8);display:flex;align-items:center;justify-content:center;font-weight:700;color:#8a7a6a;z-index:10;border-radius:10px;";
    card.appendChild(veil);
    try {
      const clean = sanitizePrompt(raw) || "gato tierno";
      const imgs = await generateWithRetry({ prompt: coloringPrompt(clean), image: "1", dimensions: $("ratio").value, steps: $("steps").value, safety: "true" }, () => {});
      const figImg = card.querySelector("figure img");
      if (figImg) figImg.src = imgs[0];
      const h = card.querySelector("h3");
      if (h) h.textContent = String(raw).slice(0, 40);
      await lineArt(imgs[0], cv, bold, raw).then(q => tagQuality(card, q));
      try { if (window.syncPainterSize) window.syncPainterSize(cv); } catch (e2) {}
    } catch (e) { status("No se pudo regenerar. " + friendlyGenError(e), true); }
    finally { veil.remove(); card.style.position = ""; bRetry.disabled = false; bRetry.textContent = oldT; }
  };
  return card;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function fetchGenerate(params, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(API + "?" + new URLSearchParams(params).toString(), { signal: ctl.signal });
    if (!r.ok) throw new Error("API " + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const imgs = d.images || [];
    if (!imgs.length) throw new Error("Sin imagenes.");
    return imgs;
  } catch (e) {
    if (e && e.name === "AbortError") throw new Error("Timeout: la API tardo demasiado.");
    throw e;
  } finally { clearTimeout(t); }
}
// Reintentos automaticos: 5xx/red/timeout -> reintenta (3 intentos, backoff);
// 4xx (salvo 429) -> falla directo. Ultimo intento con 1 imagen (carga menor).
async function generateWithRetry(base, say) {
  const waits = [0, 1500, 3000];
  let last;
  for (let a = 0; a < 3; a++) {
    if (waits[a]) { say("Servicio ocupado. Reintentando... (" + (a + 1) + "/3)"); await sleep(waits[a]); }
    else say("Creando tu dibujo... (unos segundos)");
    const p = Object.assign({}, base);
    if (a === 2 && String(base.image) !== "1") { p.image = "1"; say("Reintentando con 1 dibujo..."); }
    try { return await fetchGenerate(p, 90000); }
    catch (e) {
      last = e;
      const m = String((e && e.message) || "");
      if (/API 4\d\d/.test(m) && !/429/.test(m)) throw e;
    }
  }
  throw last;
}
function friendlyGenError(e) {
  const m = String((e && e.message) || e || "");
  if (/5\d\d|Failed to fetch|Timeout|tardo demasiado|Sin imagenes/i.test(m)) return "El servicio de dibujos esta saturado o tardo demasiado.";
  if (/429/.test(m)) return "Demasiadas peticiones seguidas. Espera unos segundos.";
  if (/API 4\d\d/.test(m)) return "La peticion fue rechazada (" + m + "). Revisa las opciones.";
  return m;
}
function showGenError(msg) {
  const s = $("status");
  s.innerHTML = "";
  s.className = "err";
  s.append(document.createTextNode(msg + " "));
  const b = document.createElement("button");
  b.className = "btn-ghost"; b.textContent = "Reintentar"; b.style.marginLeft = "8px";
  b.onclick = () => { s.className = ""; s.innerHTML = ""; gen(); };
  s.append(b);
}
$("gen").onclick = gen;
$("retry").onclick = () => { if ($("prompt").value.trim()) gen(); else status("Escribe primero que quieres colorear.", true); };
$("retry").onclick = () => { if ($("prompt").value.trim()) gen(); else status("Escribe primero que quieres colorear.", true); };
// ---------- Modo docente masivo ----------
const BOYS = ["superheroe volando sobre la ciudad","tiranosaurio rex rugiendo en la selva","cohete despegando al espacio","carro de carreras numero 7 en la pista","robot gigante amigable","barco pirata con velas y tesoro","dragon lanzando fuego","tiburon en el oceano con peces","tren cruzando las montanas","bombero apagando fuego con manguera","futbolista pateando el balon","astronauta caminando en la luna","camion monstruo saltando","ninja saltando entre tejados","policia en moto"];
const GIRLS = ["princesa con corona en su castillo","unicornio saltando sobre el arcoiris","hada con varita magica entre flores","sirena cantando en el mar","bailarina de ballet","mariposa gigante con alas decoradas","gatita con corona","helado gigante de tres bolas","pajaritos en el nido","conejita en el jardin con flores","maestra con libros en el salon","doctora con maletin","patinadora en el parque","rana sonriente sobre una hoja","abeja volando a la colmena"];
const MIXPOOL = [...new Set([...BOYS, ...GIRLS, ...IDEAS, ...CATS.map(c => c.p)])];
let bulkCancelled = false;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function pickPrompts(pool, n) {
  const out = [];
  let bag = shuffle(pool.slice());
  while (out.length < n) { if (!bag.length) bag = shuffle(pool.slice()); out.push(bag.pop()); }
  return out;
}
function bulkStatus(m, err) {
  const s = $("bulkProg");
  s.textContent = m;
  s.style.minHeight = "26px"; s.style.marginTop = "10px";
  s.style.color = err ? "#c0392b" : "#8a7a6a";
}
$("bulkMode").onchange = () => {
  const split = $("bulkMode").value === "split";
  $("wrapBoys").hidden = !split; $("wrapGirls").hidden = !split;
  sumSplit(); // en split el Total refleja la suma; ya no se bloquea
};
// Total siempre editable: en split, al editarlo reparte mitad/mitad;
// al editar ninos/ninas, el Total es la suma en vivo.
function splitTotal() {
  if ($("bulkMode").value !== "split") return;
  const t = Math.max(0, Math.min(100, parseInt($("bulkTotal").value) || 0));
  $("bulkBoys").value = Math.ceil(t / 2);
  $("bulkGirls").value = Math.floor(t / 2);
}
// En modo ninos/ninas el Total no se edita: es la suma en vivo.
function sumSplit() {
  if ($("bulkMode").value !== "split") return;
  $("bulkTotal").value = (parseInt($("bulkBoys").value) || 0) + (parseInt($("bulkGirls").value) || 0);
}
$("bulkBoys").oninput = sumSplit;
$("bulkGirls").oninput = sumSplit;
$("bulkTotal").oninput = splitTotal;
$("bulkCancel").onclick = () => { bulkCancelled = true; };
async function bulkGen() {
  const split = $("bulkMode").value === "split";
  let list;
  if (split) {
    const nb = Math.max(0, Math.min(100, parseInt($("bulkBoys").value) || 0));
    const ng = Math.max(0, Math.min(100, parseInt($("bulkGirls").value) || 0));
    if (!nb && !ng) { bulkStatus("Pon cuantos de ninos y de ninas.", true); return; }
    if (nb + ng > 100) { bulkStatus("Maximo 100 dibujos por paquete.", true); return; }
    const boys = pickPrompts(BOYS, nb), girls = pickPrompts(GIRLS, ng);
    list = [];
    for (let i = 0; i < Math.max(nb, ng); i++) { if (i < nb) list.push(boys[i]); if (i < ng) list.push(girls[i]); }
  } else {
    const total = Math.max(1, Math.min(100, parseInt($("bulkTotal").value) || 0));
    if (!total) { bulkStatus("Pon cuantos dibujos necesitas (1-100).", true); return; }
    list = pickPrompts(MIXPOOL, total);
  }
  bulkCancelled = false;
  // Limpieza inmediata tambien en paquete: lo viejo se quita al arrancar.
  $("result").innerHTML = "";
  $("bulkGo").disabled = true; $("bulkCancel").hidden = false;
  $("bulkBar").hidden = false; $("bulkBar").max = list.length; $("bulkBar").value = 0;
  bulkStatus("Generando 0/" + list.length + "...");
  let done = 0, ok = 0, fail = 0;
  const shared = { i: 0 };
  const worker = async () => {
    while (!bulkCancelled) {
      let idx = -1;
      if (shared.i < list.length) idx = shared.i++;
      else return;
      const subject = list[idx];
      try {
        const clean = sanitizePrompt(subject) || "gato tierno";
        const imgs = await generateWithRetry({ prompt: coloringPrompt(clean), image: "1", dimensions: $("ratio").value, steps: $("steps").value, safety: "true" }, () => {});
        await processImage(subject, imgs[0], $("result"), { paint: false }); // aula: sin Colorear
        ok++;
        made++; try { localStorage.setItem("made", made); } catch (e) {}
        paintCount();
      } catch (e) { fail++; }
      done++;
      $("bulkBar").value = done;
      bulkStatus("Generando " + done + "/" + list.length + "...");
    }
  };
  // 5 dibujos a la vez: la API aguanta y el reintento con backoff absorbe los 429.
  await Promise.all([worker(), worker(), worker(), worker(), worker()]);
  $("bulkGo").disabled = false; $("bulkCancel").hidden = true;
  if (bulkCancelled) bulkStatus("Cancelado: " + ok + " dibujos listos.", true);
  else bulkStatus("Paquete listo: " + ok + " dibujos." + (fail ? " (" + fail + " fallaron, genera de nuevo)" : ""));
  if (ok && !bulkCancelled) $("result").scrollIntoView({ behavior: "smooth", block: "start" });
}
$("bulkGo").onclick = bulkGen;
// ---------- Imprimir / descargar todo + pestanas ----------
function galleryBases() {
  const out = [];
  document.querySelectorAll("#result .page").forEach(card => {
    const cvs = card.querySelectorAll("canvas");
    for (const cv of cvs) {
      if (!cv.classList.contains("paint-layer") && cv.width > 0) { out.push(cv); break; }
    }
  });
  return out;
}
// ---------- Impresion: version editada + layouts ----------
// El pintor dibuja en una capa aparte (.paint-layer); el canvas base solo tiene el line-art.
// Para imprimir lo pintado hay que fusionar ambas capas (multiply, como se ve en pantalla).
function paintLayerOf(baseCv) {
  try {
    var stack = baseCv.closest ? baseCv.closest(".paint-stack") : null;
    if (stack) return stack.querySelector(".paint-layer");
    var p = baseCv.parentNode;
    if (p && p.querySelector) return p.querySelector(".paint-layer");
  } catch (e) {}
  return null;
}
// ¿La capa tiene algo pintado? Muestreo de alfa (rapido aun en 768x768).
function paintHasContent(paint) {
  try {
    var w = paint.width, h = paint.height;
    if (!w || !h) return false;
    var d = paint.getContext("2d").getImageData(0, 0, w, h).data;
    for (var i = 3; i < d.length; i += 64) { if (d[i] > 8) return true; }
  } catch (e) {}
  return false;
}
// Fusiona base + capa -> { original, edited|null }. Null edited si no hay edicion.
function compositeURL(baseCv) {
  var out = { original: null, edited: null };
  try { out.original = baseCv.toDataURL("image/png"); } catch (e) { return out; }
  var paint = paintLayerOf(baseCv);
  if (!paint || !paintHasContent(paint)) return out;
  try {
    var c = document.createElement("canvas");
    c.width = baseCv.width; c.height = baseCv.height;
    var x = c.getContext("2d");
    x.drawImage(baseCv, 0, 0);
    x.globalCompositeOperation = "multiply";
    x.drawImage(paint, 0, 0, c.width, c.height);
    x.globalCompositeOperation = "source-over";
    out.edited = c.toDataURL("image/png");
  } catch (e) { out.edited = null; }
  return out;
}
// Dialogo de impresion: version (solo si hay edicion) + tamano + tip de encabezados.
function openPrintDialog(items) {
  items = (items || []).filter(function (it) { return it && (it.original || it.edited); });
  if (!items.length) { status("No se pudieron leer los dibujos.", true); return; }
  var anyEdited = items.some(function (it) { return !!it.edited; });
  var ov = document.createElement("div");
  ov.style.cssText = "position:fixed;inset:0;background:rgba(43,33,24,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px";
  var box = document.createElement("div");
  box.style.cssText = "background:#fffdf8;border-radius:14px;max-width:430px;width:100%;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.3);color:#2b2118";
  var h = document.createElement("h3");
  h.textContent = items.length > 1 ? "Imprimir " + items.length + " dibujos" : "Imprimir dibujo";
  h.style.margin = "0 0 10px";
  box.appendChild(h);
  function group(title, name, opts, def) {
    var fs = document.createElement("div");
    fs.style.margin = "0 0 10px";
    var t = document.createElement("div");
    t.textContent = title;
    t.style.fontWeight = "700"; t.style.marginBottom = "4px";
    fs.appendChild(t);
    opts.forEach(function (o) {
      var lab = document.createElement("label");
      lab.style.display = "block"; lab.style.margin = "4px 0"; lab.style.cursor = "pointer";
      var r = document.createElement("input");
      r.type = "radio"; r.name = name; r.value = o[0];
      if (o[0] === def) r.checked = true;
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(" " + o[1]));
      fs.appendChild(lab);
    });
    box.appendChild(fs);
  }
  if (anyEdited) group("Versión", "pver", [["mine", "Mi versión coloreada"], ["orig", "Original en blanco y negro"]], "mine");
  group("Tamaño", "psize", [["full", "Página completa (1 por hoja)"], ["half", "Media página (2 por hoja)"], ["quad", "Pequeños (4 por hoja)"]], "full");
  var tip = document.createElement("p");
  tip.style.cssText = "font-size:.82rem;color:#8a7a6a;margin:6px 0 12px";
  tip.textContent = "Tip: en la ventana de impresión desactiva “Encabezados y pies de página” para que no salgan fecha ni dirección web.";
  box.appendChild(tip);
  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:10px;justify-content:flex-end";
  var bC = document.createElement("button"); bC.className = "btn-ghost"; bC.textContent = "Cancelar";
  var bP = document.createElement("button"); bP.className = "btn-primary"; bP.textContent = "Imprimir";
  row.append(bC, bP); box.appendChild(row);
  ov.appendChild(box); document.body.appendChild(ov);
  function sel(name) { var r = box.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  bC.onclick = function () { ov.remove(); };
  ov.addEventListener("mousedown", function (e) { if (e.target === ov) ov.remove(); });
  bP.onclick = function () {
    var ver = anyEdited ? sel("pver") : "orig";
    var size = sel("psize") || "full";
    ov.remove();
    launchPrint(items, ver, size);
  };
}
function launchPrint(items, ver, size) {
  var srcs = items.map(function (it) { return (ver === "mine" && it.edited) ? it.edited : (it.original || it.edited); }).filter(Boolean);
  if (!srcs.length) { status("No se pudieron leer los dibujos.", true); return; }
  // Sin scripts inline en la hoja (el CSP de la pagina se hereda al popup y los bloquearia):
  // la impresion se dispara desde esta ventana (opener).
  var css = "@page{margin:12mm}body{margin:0;background:#fff;font-family:sans-serif}" +
    "figure{margin:0}" +
    ".full figure:not(:last-child){page-break-after:always;break-after:page}" +
    ".full img{display:block;width:auto;max-width:100%;max-height:94vh;margin:0 auto}" +
    ".half img{display:block;width:auto;max-width:100%;max-height:44vh;margin:0 auto 8mm;page-break-inside:avoid}" +
    ".quad .wrap{display:grid;grid-template-columns:1fr 1fr;gap:6mm;align-items:center}" +
    ".quad img{display:block;width:100%;height:auto;max-height:40vh;object-fit:contain;page-break-inside:avoid}";
  var inner;
  if (size === "quad") {
    inner = '<div class="wrap">' + srcs.map(function (s) { return '<img src="' + s + '">'; }).join("") + "</div>";
  } else {
    inner = srcs.map(function (s) { return '<figure><img src="' + s + '"></figure>'; }).join("");
  }
  var html = "<html><head><title>Colorable</title><style>" + css + "</style></head>" +
    '<body class="' + size + '">' + inner + "</body></html>";
  var w = window.open("", "_blank");
  if (!w) { status("El navegador bloqueó la ventana de impresión.", true); return; }
  w.document.write(html);
  w.document.close();
  var done = false;
  var go = function () {
    if (done) return; done = true;
    try {
      // Al cerrar el dialogo de impresion se cierra el popup y se devuelve
      // el foco: asi no queda una ventana huerfana estorbando (bloquea
      // descargas y clics en la pagina principal mientras siga abierta).
      w.onafterprint = function () { try { w.close(); } catch (e) {} try { window.focus(); } catch (e2) {} };
      w.focus(); w.print();
    } catch (e) { try { w.close(); } catch (e2) {} }
  };
  try { w.onload = function () { setTimeout(go, 350); }; } catch (e) {}
  setTimeout(go, 2500); // respaldo si onload ya pasó
}
function printAll() {
  const bases = galleryBases();
  if (!bases.length) { status("No hay dibujos en la galeria para imprimir.", true); return; }
  const items = bases.map(function (cv) { var u = compositeURL(cv); return { original: u.original, edited: u.edited }; });
  openPrintDialog(items);
}
async function downloadAll() {
  const bases = galleryBases();
  if (!bases.length) { status("No hay dibujos en la galeria para descargar.", true); return; }
  // Plan A: un solo ZIP (paquete-colorear.zip). Requiere la libreria JSZip (CDN).
  if (window.JSZip) {
    try {
      bulkStatus("Armando ZIP con " + bases.length + " dibujos...");
      const zip = new window.JSZip();
      let i = 0;
      for (const cv of bases) {
        // Si la tarjeta se pinto, el ZIP lleva la version coloreada.
        const url = canvasExportURL(cv) || "";
        if (!url) continue;
        const b64 = url.split(",")[1];
        if (!b64) continue;
        i++;
        zip.file("colorear-" + String(i).padStart(2, "0") + ".png", b64, { base64: true });
        if (i % 5 === 0) bulkStatus("Armando ZIP " + i + "/" + bases.length + "...");
      }
      if (!i) throw new Error("vacio");
      const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }, (meta) => {
        bulkStatus("Comprimiendo " + Math.round(meta.percent) + "%...");
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "paquete-colorear.zip";
      document.body.appendChild(a); a.click();
      setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) {} a.remove(); }, 5000);
      bulkStatus("ZIP listo: paquete-colorear.zip con " + i + " dibujos en tu carpeta de descargas.");
      return;
    } catch (e) { /* cae al plan B */ }
  }
  // Plan B: descargas una por una (sin libreria o fallo el ZIP).
  bulkStatus("ZIP no disponible: descargando uno por uno...");
  let j = 0;
  for (const cv of bases) {
    try {
      const url = canvasExportURL(cv);
      if (!url) continue;
      const a = document.createElement("a");
      a.href = url;
      a.download = "colorear-paquete-" + (++j) + ".png";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {}
    await sleep(400);
  }
  bulkStatus("Descarga lista: " + j + " dibujos en tu carpeta de descargas.");
}
$("printAll").onclick = printAll;
$("dlAll").onclick = downloadAll;
function switchTab(id) {
  ["sec-crear", "bulk", "catalog"].forEach(s => { const el = document.getElementById(s); if (el) el.hidden = (s !== id); });
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x.getAttribute("data-tab") === id));
}
$("tabs").onclick = e => {
  const b = e.target.closest ? e.target.closest("button[data-tab]") : null;
  if (!b) return;
  switchTab(b.getAttribute("data-tab"));
};
// ---------- Catalogo de prompts probados ----------
const CATALOG = [
  { t: "Leon en la selva", c: "animales", p: "leon entre palmeras en la selva" },
  { t: "Gatito astronauta", c: "animales", p: "gatito con casco de astronauta" },
  { t: "Perrito bombero", c: "animales", p: "perrito bombero con manguera y casco" },
  { t: "Tiburon amigable", c: "animales", p: "tiburon amigable con peces y corales" },
  { t: "Conejo en el huerto", c: "animales", p: "conejo comiendo zanahoria en el huerto" },
  { t: "Cohete despegando", c: "vehiculos", p: "cohete despegando al espacio con humo" },
  { t: "Carro de carreras", c: "vehiculos", p: "carro de carreras numero 7 en la pista" },
  { t: "Barco pirata", c: "vehiculos", p: "barco pirata con velas y bandera" },
  { t: "Tren en las montanas", c: "vehiculos", p: "tren cruzando un puente en las montanas" },
  { t: "Avion entre nubes", c: "vehiculos", p: "avion volando entre nubes" },
  { t: "Astronauta en la luna", c: "espacio", p: "astronauta plantando bandera en la luna" },
  { t: "Planeta con anillos", c: "espacio", p: "planeta con anillos y estrellas alrededor" },
  { t: "Estacion espacial", c: "espacio", p: "estacion espacial con dos astronautas" },
  { t: "Ovni en la ciudad", c: "espacio", p: "ovni sobrevolando la ciudad de noche" },
  { t: "Robot en Marte", c: "espacio", p: "robot explorador caminando en marte" },
  { t: "Dragon bebe", c: "fantasia", p: "dragon bebe lanzando fuego pequeno" },
  { t: "Unicornio y arcoiris", c: "fantasia", p: "unicornio saltando sobre el arcoiris" },
  { t: "Castillo con banderas", c: "fantasia", p: "castillo con torres altas y banderas" },
  { t: "Hada entre flores", c: "fantasia", p: "hada con varita magica entre flores" },
  { t: "Mago y conejo", c: "fantasia", p: "mago con sombrero sacando un conejo" },
  { t: "Bombero en accion", c: "profesiones", p: "bombero apagando fuego con manguera" },
  { t: "Doctora amable", c: "profesiones", p: "doctora revisando a un nino" },
  { t: "Maestra en el salon", c: "profesiones", p: "maestra con libros en el salon de clase" },
  { t: "Policia de trafico", c: "profesiones", p: "policia dirigiendo el trafico" },
  { t: "Chef pastelero", c: "profesiones", p: "chef con pastel gigante y gorro" },
  { t: "Arbol con columpio", c: "naturaleza", p: "arbol grande con columpio" },
  { t: "Girasol soleado", c: "naturaleza", p: "girasol gigante bajo el sol" },
  { t: "Montana y rio", c: "naturaleza", p: "montana con rio y pinos" },
  { t: "Playa con cangrejo", c: "naturaleza", p: "playa con palmeras y cangrejo" },
  { t: "Ciervo en el bosque", c: "naturaleza", p: "ciervo entre arboles y setas" },
  { t: "Pastel de cumpleanos", c: "fiestas", p: "pastel de cumpleanos con velas y globos" },
  { t: "Arbol de navidad", c: "fiestas", p: "arbol de navidad con regalos y estrella" },
  { t: "Calabaza sonriente", c: "fiestas", p: "calabaza de halloween sonriente" },
  { t: "Pinata de estrella", c: "fiestas", p: "pinata de estrella con dulces" },
  { t: "Payaso en el circo", c: "fiestas", p: "payaso con globos en el circo" },
  { t: "Princesa y corona", c: "personajes", p: "princesa con vestido y corona" },
  { t: "Superheroe en la ciudad", c: "personajes", p: "superheroe volando sobre la ciudad" },
  { t: "Pirata y tesoro", c: "personajes", p: "pirata con mapa del tesoro en la isla" },
  { t: "Bailarina", c: "personajes", p: "bailarina de ballet bailando" },
  { t: "Ninja saltando", c: "personajes", p: "ninja saltando entre tejados" },
  { t: "Elefante de fiesta", c: "animales", p: "elefante con sombrero de fiesta y pastel" },
  { t: "Pinguino patinador", c: "animales", p: "pinguino patinando en el hielo" },
  { t: "Rana en la hoja", c: "animales", p: "rana sonriente sobre una hoja grande" },
  { t: "Abeja y flores", c: "animales", p: "abeja volando entre flores" },
  { t: "Buho sabio", c: "animales", p: "buho sabio sobre una rama de noche" },
  { t: "Canguro con bebe", c: "animales", p: "canguro con su bebe en la bolsa" },
  { t: "Oso panda", c: "animales", p: "oso panda comiendo bambu" },
  { t: "Caballo galopando", c: "animales", p: "caballo galopando en el campo" },
  { t: "Pollito en el nido", c: "animales", p: "pollito saliendo del cascaron en el nido" },
  { t: "Mono colgado", c: "animales", p: "mono colgado de una rama con bananas" },
  { t: "Cebra rayada", c: "animales", p: "cebra pastando en la sabana" },
  { t: "Jirafa alta", c: "animales", p: "jirafa comiendo hojas del arbol mas alto" },
  { t: "Cerdito en el lodo", c: "animales", p: "cerdito feliz revolcandose en el lodo" },
  { t: "Pato en el lago", c: "animales", p: "pato nadando en el lago con patitos" },
  { t: "Gallo madrugador", c: "animales", p: "gallo cantando al amanecer en la granja" },
  { t: "Koala dormilon", c: "animales", p: "koala durmiendo abrazado a un eucalipto" },
  { t: "Ardilla y nuez", c: "animales", p: "ardilla sosteniendo una nuez gigante" },
  { t: "Camaleon en rama", c: "animales", p: "camaleon enroscado en una rama" },
  { t: "Lobo aullando", c: "animales", p: "lobo aullando a la luna llena" },
  { t: "Conejito y zanahorias", c: "animales", p: "conejito cargando carretilla de zanahorias" },
  { t: "Submarino amarillo", c: "vehiculos", p: "submarino amarillo entre peces" },
  { t: "Helicoptero de rescate", c: "vehiculos", p: "helicoptero de rescate volando" },
  { t: "Camion de bomberos", c: "vehiculos", p: "camion de bomberos con escalera extendida" },
  { t: "Tractor en el campo", c: "vehiculos", p: "tractor arando el campo" },
  { t: "Moto veloz", c: "vehiculos", p: "moto veloz en la carretera" },
  { t: "Bicicleta con canasta", c: "vehiculos", p: "bicicleta con canasta de flores" },
  { t: "Velero en el mar", c: "vehiculos", p: "velero navegando con gaviotas" },
  { t: "Globo aerostatico", c: "vehiculos", p: "globo aerostatico sobrevolando el valle" },
  { t: "Trineo en la nieve", c: "vehiculos", p: "trineo jalado por perros en la nieve" },
  { t: "Autobus escolar", c: "vehiculos", p: "autobus escolar amarillo en la parada" },
  { t: "Excavadora", c: "vehiculos", p: "excavadora construyendo un edificio" },
  { t: "Patineta en el parque", c: "vehiculos", p: "patineta en la pista del parque" },
  { t: "Crucero gigante", c: "vehiculos", p: "crucero gigante saliendo del puerto" },
  { t: "Avioneta acrobatica", c: "vehiculos", p: "avioneta haciendo piruetas entre nubes" },
  { t: "Camion de helados", c: "vehiculos", p: "camion de helados con ninos en fila" },
  { t: "Nino astronauta", c: "espacio", p: "nino astronauta flotando con bandera" },
  { t: "Satelite orbitando", c: "espacio", p: "satelite orbitando la tierra" },
  { t: "Lluvia de estrellas", c: "espacio", p: "lluvia de estrellas sobre la montana" },
  { t: "Alien amigable", c: "espacio", p: "alien amigable saludando con tres ojos" },
  { t: "Telescopio gigante", c: "espacio", p: "nino mirando planetas por telescopio gigante" },
  { t: "Cohete a la luna", c: "espacio", p: "cohete viajando a la luna llena" },
  { t: "Caminata espacial", c: "espacio", p: "dos astronautas flotando junto a la estacion" },
  { t: "Constelacion del leon", c: "espacio", p: "constelacion de estrellas formando un leon" },
  { t: "Base lunar", c: "espacio", p: "base lunar con domos y astronauta" },
  { t: "Cometa veloz", c: "espacio", p: "cometa cruzando el cielo nocturno" },
  { t: "Sirena en la roca", c: "fantasia", p: "sirena peinandose sobre una roca" },
  { t: "Caballero y escudo", c: "fantasia", p: "caballero con escudo y espada" },
  { t: "Varita magica", c: "fantasia", p: "varita magica con chispas y estrellas" },
  { t: "Alfombra voladora", c: "fantasia", p: "nino volando en alfombra magica" },
  { t: "Fuente de los deseos", c: "fantasia", p: "fuente de piedra con moneda" },
  { t: "Duende del bosque", c: "fantasia", p: "duende sonriente entre hongos gigantes" },
  { t: "Pegaso alado", c: "fantasia", p: "pegaso blanco galopando entre nubes" },
  { t: "Genio de la lampara", c: "fantasia", p: "lampara magica con genio saliendo" },
  { t: "Espada en la piedra", c: "fantasia", p: "espada clavada en una piedra" },
  { t: "Corona real", c: "fantasia", p: "corona real con joyas sobre un cojin" },
  { t: "Dragon dormido", c: "fantasia", p: "dragon dormido sobre monedas de oro" },
  { t: "Aprendiz de mago", c: "fantasia", p: "aprendiz de mago con libro de hechizos" },
  { t: "Espejo magico", c: "fantasia", p: "espejo magico ovalado con marco" },
  { t: "Llave dorada", c: "fantasia", p: "llave dorada abriendo cofre del tesoro" },
  { t: "Carruaje con caballos", c: "fantasia", p: "carruaje elegante con caballos blancos" },
  { t: "Torre encantada", c: "fantasia", p: "torre alta con reloj y enredaderas" },
  { t: "Mapa del tesoro", c: "fantasia", p: "mapa del tesoro con equis marcada" },
  { t: "Buho con carta", c: "fantasia", p: "buho llevando una carta en el pico" },
  { t: "Olla del arcoiris", c: "fantasia", p: "olla de monedas al final del arcoiris" },
  { t: "Huevo de dragon", c: "fantasia", p: "huevo de dragon moteado en un nido" },
  { t: "Carpintero", c: "profesiones", p: "carpintero martillando una mesa" },
  { t: "Veterinaria", c: "profesiones", p: "veterinaria revisando a un perrito" },
  { t: "Panadero", c: "profesiones", p: "panadero sacando pan del horno" },
  { t: "Granjero", c: "profesiones", p: "granjero alimentando gallinas en el corral" },
  { t: "Cientifica", c: "profesiones", p: "cientifica mezclando liquidos en tubos" },
  { t: "Piloto", c: "profesiones", p: "piloto saludando desde la cabina" },
  { t: "Jardinera", c: "profesiones", p: "jardinera regando flores del jardin" },
  { t: "Mecanico", c: "profesiones", p: "mecanico arreglando un carro" },
  { t: "Dentista", c: "profesiones", p: "dentista revisando dientes grandes" },
  { t: "Buzo", c: "profesiones", p: "buzo nadando junto a una tortuga" },
  { t: "Cascada", c: "naturaleza", p: "cascada cayendo entre rocas" },
  { t: "Volcan", c: "naturaleza", p: "volcan con humo y palmeras" },
  { t: "Arcoiris tras la lluvia", c: "naturaleza", p: "arcoiris saliendo tras la lluvia" },
  { t: "Desierto y cactus", c: "naturaleza", p: "cactus alto con sol en el desierto" },
  { t: "Lago tranquilo", c: "naturaleza", p: "lago tranquilo con patos y montanas" },
  { t: "Cueva con estalactitas", c: "naturaleza", p: "cueva con estalactitas y murcielago" },
  { t: "Huerto", c: "naturaleza", p: "huerto con tomates y calabazas" },
  { t: "Colmena", c: "naturaleza", p: "colmena colgando de un arbol" },
  { t: "Nido con huevos", c: "naturaleza", p: "nido con tres huevos moteados" },
  { t: "Puente de madera", c: "naturaleza", p: "puente de madera sobre un rio" },
  { t: "Isla con palmera", c: "naturaleza", p: "isla pequena con una palmera" },
  { t: "Copo de nieve", c: "naturaleza", p: "copo de nieve gigante de seis puntas" },
  { t: "Setas del bosque", c: "naturaleza", p: "setas grandes entre hojas del bosque" },
  { t: "Espantapajaros", c: "naturaleza", p: "espantapajaros en campo de maiz" },
  { t: "Oruga verde", c: "naturaleza", p: "oruga verde sobre una hoja" },
  { t: "Nino pidiendo dulces", c: "fiestas", p: "nino disfrazado pidiendo dulces" },
  { t: "Fantasma amigable", c: "fiestas", p: "fantasma amigable flotando de noche" },
  { t: "Murcielago colgado", c: "fiestas", p: "murcielago colgado boca abajo" },
  { t: "Reno navideno", c: "fiestas", p: "reno con nariz roja y bufanda" },
  { t: "Muneco de nieve", c: "fiestas", p: "muneco de nieve con sombrero" },
  { t: "Campanas de navidad", c: "fiestas", p: "campanas de navidad con mono" },
  { t: "Conejo de pascua", c: "fiestas", p: "conejo de pascua con canasta de huevos" },
  { t: "Serpentinas", c: "fiestas", p: "ninos lanzando serpentinas en fiesta" },
  { t: "Corona navidena", c: "fiestas", p: "corona navidena con velas" },
  { t: "Caja de regalo", c: "fiestas", p: "caja de regalo abierta con sorpresa" },
  { t: "Rey en su trono", c: "personajes", p: "rey sentado en su trono" },
  { t: "Reina con abanico", c: "personajes", p: "reina con abanico y joyas" },
  { t: "Vaquero", c: "personajes", p: "vaquero con sombrero y lazo" },
  { t: "Bailarin de tap", c: "personajes", p: "bailarin con zapatos de tap" },
  { t: "Mimo", c: "personajes", p: "mimo haciendo truco invisible" },
  { t: "Vikingo", c: "personajes", p: "vikingo con casco y barco" },
  { t: "Samurai", c: "personajes", p: "samurai con espada y armadura" },
  { t: "Exploradora", c: "personajes", p: "exploradora con brujula y mapa" },
  { t: "Detective", c: "personajes", p: "detective con lupa y gabardina" },
  { t: "Inventor", c: "personajes", p: "inventor con robot pequeno" },
  { t: "Angel entre nubes", c: "personajes", p: "angel con alas entre nubes" },
  { t: "Pastor", c: "personajes", p: "pastor cuidando ovejas en el campo" },
  { t: "Heladero", c: "personajes", p: "heladero con carrito de helados" },
  { t: "Malabarista", c: "personajes", p: "malabarista con tres pelotas" },
  { t: "Trapecista", c: "personajes", p: "trapecista volando en el circo" },
  { t: "Domador de leones", c: "personajes", p: "domador con leon manso" },
  { t: "Nadadora", c: "personajes", p: "nadadora con flotador de pato" },
  { t: "Esquiador", c: "personajes", p: "esquiador bajando la montana" },
  { t: "Ciclista", c: "personajes", p: "ciclista con casco en la meta" },
  { t: "Arquero", c: "personajes", p: "arquero apuntando al blanco" },
  { t: "Portero atajando", c: "deportes", p: "portero atajando un balon" },
  { t: "Enceste de basket", c: "deportes", p: "jugador encestando en basket" },
  { t: "Home run", c: "deportes", p: "beisbolista bateando home run" },
  { t: "Tenista", c: "deportes", p: "tenista devolviendo la pelota" },
  { t: "Nadador en piscina", c: "deportes", p: "nadador en piscina olimpica" },
  { t: "Corredor veloz", c: "deportes", p: "corredor cruzando la meta" },
  { t: "Karateca", c: "deportes", p: "karateca rompiendo una tabla" },
  { t: "Gimnasta", c: "deportes", p: "gimnasta en la viga de equilibrio" },
  { t: "Boxeador entrenando", c: "deportes", p: "boxeador entrenando con saco" },
  { t: "Patinador en rampa", c: "deportes", p: "patinador saltando una rampa alta" },
  { t: "Pizza grande", c: "comida", p: "pizza grande con ingredientes" },
  { t: "Hamburguesa doble", c: "comida", p: "hamburguesa doble con papas" },
  { t: "Chocolate caliente", c: "comida", p: "taza de chocolate caliente humeante" },
  { t: "Canasta de frutas", c: "comida", p: "canasta con manzanas y uvas" },
  { t: "Tajada de sandia", c: "comida", p: "tajada de sandia sonriente" },
  { t: "Paleta de fresa", c: "comida", p: "paleta de hielo de fresa" },
  { t: "Tres tacos", c: "comida", p: "tres tacos en un plato" },
  { t: "Galletas con chispas", c: "comida", p: "galletas con chispas en plato" },
  { t: "Pina tropical", c: "comida", p: "pina tropical con hojas" },
  { t: "Desayuno", c: "comida", p: "desayuno con huevos y pan" },
  { t: "Oso de peluche", c: "juguetes", p: "oso de peluche abrazando un corazon" },
  { t: "Bloques altos", c: "juguetes", p: "bloques armando una torre alta" },
  { t: "Tren de juguete", c: "juguetes", p: "tren de juguete con vagones" },
  { t: "Muneca con lazo", c: "juguetes", p: "muneca con vestido y lazo" },
  { t: "Cometa de papel", c: "juguetes", p: "cometa de papel volando alto" },
  { t: "Trompo girando", c: "juguetes", p: "trompo girando con cuerda" },
  { t: "Pelota playera", c: "juguetes", p: "pelota playera a rayas" },
  { t: "Cubo y pala", c: "juguetes", p: "cubo y pala en la arena" },
  { t: "Robot de juguete", c: "juguetes", p: "robot de juguete con botones" },
  { t: "Caballito de madera", c: "juguetes", p: "caballito balancin de madera" },
  { t: "Ballena", c: "mar", p: "ballena lanzando chorro de agua" },
  { t: "Pulpo", c: "mar", p: "pulpo con ocho tentaculos" },
  { t: "Tortuga marina", c: "mar", p: "tortuga marina nadando tranquila" },
  { t: "Delfin saltando", c: "mar", p: "delfin saltando entre olas" },
  { t: "Caballito de mar", c: "mar", p: "caballito de mar entre algas" },
  { t: "Cangrejo", c: "mar", p: "cangrejo caminando de lado" },
  { t: "Estrella de mar", c: "mar", p: "estrella de mar sobre la arena" },
  { t: "Faro en la costa", c: "mar", p: "faro alto en costa rocosa" },
  { t: "Ancla grande", c: "mar", p: "ancla grande con cuerda" },
  { t: "Arrecife", c: "mar", p: "arrecife con peces y corales" }
];
const CAT_FILTERS = ["todos","animales","vehiculos","espacio","fantasia","profesiones","naturaleza","fiestas","personajes","deportes","comida","juguetes","mar"];
let catFilter = "todos";
let catShown = 12; // paginado: 200 tarjetas de golpe = ruido visual
const CAT_PAGE = 12;
function renderCatChips() {
  $("catChips").innerHTML = "";
  for (const f of CAT_FILTERS) {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = f;
    if (f === catFilter) b.style.borderColor = "var(--brand)";
    b.onclick = () => { catFilter = f; catShown = CAT_PAGE; renderCatChips(); renderCatalog(); };
    $("catChips").append(b);
  }
}
function renderCatalog() {
  const q = norm(($("catQ").value || "").trim());
  const grid = $("catGrid");
  grid.innerHTML = "";
  const matches = [];
  for (const e of CATALOG) {
    if (catFilter !== "todos" && e.c !== catFilter) continue;
    if (q && norm(e.t + " " + e.p + " " + e.c).indexOf(q) === -1) continue;
    matches.push(e);
  }
  const vis = matches.slice(0, catShown);
  for (const e of vis) {
    const d = document.createElement("div");
    d.className = "catcard";
    const h = document.createElement("h4"); h.textContent = e.t;
    const pp = document.createElement("p"); pp.textContent = e.p; pp.title = e.p;
    const b = document.createElement("button"); b.className = "btn-mini"; b.textContent = "Usar";
    b.onclick = async () => {
      // Feedback claro: el boton dice Generando, el prompt queda cargado en Crear
      // y la vista baja a la galeria donde aparece el dibujo (antes te mandaba arriba sin contexto).
      if (b.disabled) return;
      const old = b.textContent; b.disabled = true; b.textContent = "...";
      $("prompt").value = e.p;
      $("result").scrollIntoView({ behavior: "smooth", block: "start" });
      try { await gen(); } finally { b.disabled = false; b.textContent = old; }
    };
    d.append(h, pp, b);
    grid.append(d);
  }
  const cc = $("catCount");
  cc.innerHTML = "";
  cc.append(document.createTextNode(vis.length + " de " + matches.length + " prompts "));
  if (catShown < matches.length) {
    const more = document.createElement("button");
    more.className = "btn-ghost"; more.textContent = "Mostrar mas (" + (matches.length - catShown) + ")";
    more.style.fontSize = ".8rem"; more.style.padding = "6px 12px";
    more.onclick = () => { catShown += 24; renderCatalog(); };
    cc.append(more);
  }
}
$("catQ").oninput = () => { catShown = CAT_PAGE; renderCatalog(); };
renderCatChips(); renderCatalog();
function printOne(cv) {
  var u = compositeURL(cv);
  if (!u.original && !u.edited) { status("No se pudo leer el dibujo.", true); return; }
  openPrintDialog([{ original: u.original, edited: u.edited }]);
}
// Descarga una tarjeta: si hay pintura ofrece version coloreada u original
// (igual que el dialogo de impresion); sin edicion descarga directo.
function canvasExportURL(cv) {
  try {
    var u = compositeURL(cv);
    return u.edited || u.original || null;
  } catch (e) { return null; }
}
function saveURL(url, name) {
  if (!url) { status("No se pudo leer el dibujo.", true); return; }
  try {
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { status("No se pudo descargar: regenera el dibujo.", true); }
}
function downloadOne(cv) {
  var u = compositeURL(cv);
  if (!u.original && !u.edited) { status("No se pudo leer el dibujo.", true); return; }
  if (!u.edited) { saveURL(u.original, "colorear-" + Date.now() + ".png"); return; }
  var ov = document.createElement("div");
  ov.style.cssText = "position:fixed;inset:0;background:rgba(43,33,24,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px";
  var box = document.createElement("div");
  box.style.cssText = "background:#fffdf8;border-radius:14px;max-width:380px;width:100%;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.3);color:#2b2118";
  var h = document.createElement("h3");
  h.textContent = "Descargar dibujo";
  h.style.margin = "0 0 10px";
  box.appendChild(h);
  [["mine", "Mi versión coloreada"], ["orig", "Original en blanco y negro"]].forEach(function (o, ix) {
    var lab = document.createElement("label");
    lab.style.display = "block"; lab.style.margin = "4px 0"; lab.style.cursor = "pointer";
    var r = document.createElement("input");
    r.type = "radio"; r.name = "dver"; r.value = o[0];
    if (ix === 0) r.checked = true;
    lab.appendChild(r);
    lab.appendChild(document.createTextNode(" " + o[1]));
    box.appendChild(lab);
  });
  var row = document.createElement("div");
  row.style.cssText = "display:flex;gap:10px;justify-content:flex-end;margin-top:12px";
  var bC = document.createElement("button"); bC.className = "btn-ghost"; bC.textContent = "Cancelar";
  var bD = document.createElement("button"); bD.className = "btn-primary"; bD.textContent = "Descargar";
  row.append(bC, bD); box.appendChild(row);
  ov.appendChild(box); document.body.appendChild(ov);
  bC.onclick = function () { ov.remove(); };
  ov.addEventListener("mousedown", function (e) { if (e.target === ov) ov.remove(); });
  bD.onclick = function () {
    var sel = box.querySelector('input[name="dver"]:checked');
    var src = (sel && sel.value === "orig") ? (u.original || u.edited) : (u.edited || u.original);
    ov.remove();
    saveURL(src, "coloreado-" + Date.now() + ".png");
  };
}
// Carga via proxy propio (/api/image) para evitar CORS, luego Sobel -> line-art.
function lineArt(url, cv, bold, label) {
  const proxied = "/api/image?url=" + encodeURIComponent(url);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        resolve(paintLineArt(img, cv, bold));
      } catch (e) { reject(new Error("Fallo line-art: " + e.message)); }
    };
    img.onerror = () => {
      // Ultimo recurso: dibujar el original DIRECTO en el canvas (sin leer pixeles).
      // Asi el pintor sigue funcionando (pinta en su propia capa).
      try {
        const im2 = new Image();
        im2.onload = () => {
          try {
            const S = 768; cv.width = S; cv.height = S;
            const c2 = cv.getContext("2d");
            c2.fillStyle = "#fff"; c2.fillRect(0, 0, S, S);
            const ar = im2.width / im2.height || 1;
            let dw = S, dh = S;
            if (ar > 1) { dh = S / ar; } else { dw = S * ar; }
            c2.drawImage(im2, (S - dw) / 2, (S - dh) / 2, dw, dh);
          } catch (e2) {}
          resolve();
        };
        im2.onerror = () => resolve();
        im2.referrerPolicy = "no-referrer";
        im2.src = url;
      } catch (e) { resolve(); }
    };
    img.src = proxied;
  });
}
function paintLineArt(img, cv, bold) {
  const S = 768;
  cv.width = S; cv.height = S;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, S, S);
  const off = document.createElement("canvas");
  off.width = S; off.height = S;
  const o = off.getContext("2d");
  const ar = img.width / img.height || 1;
  let dw = S, dh = S;
  if (ar > 1) { dh = S / ar; } else { dw = S * ar; }
  o.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh);
  const id = o.getImageData(0, 0, S, S);
  const d = id.data;
  const gray = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) {
    gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  }
  // 0) Analisis: si la IA ya devolvio line-art limpio (casi todo blanco y negro),
  //    NO se usa Sobel: el detector de bordes duplica cada trazo fino y empasta
  //    las masas (medido: 11% tinta real -> 28% empastada). Via directa: umbral.
  let midN = 0, darkN = 0;
  for (let i = 0; i < S * S; i += 7) {
    const g = gray[i];
    if (g >= 0.157 && g <= 0.823) midN++;
    if (g < 0.39) darkN++;
  }
  const nSamp = Math.ceil(S * S / 7);
  if (midN / nSamp < 0.08 && darkN / nSamp > 0.02 && darkN / nSamp < 0.22) {
    let cm = new Uint8Array(S * S);
    for (let i = 0; i < S * S; i++) if (gray[i] < 0.667) cm[i] = 1;
    cm = closeBox(cm, S, 1);
    cm = dropSmall(cm, S, 12);
    if (bold) cm = dilateBox(cm, S, 1); // trazo grueso marcado
    const out0 = c.createImageData(S, S);
    let black0 = 0;
    for (let i = 0; i < S * S; i++) {
      const v = cm[i] ? 0 : 255;
      if (cm[i]) black0++;
      out0.data[i * 4] = v; out0.data[i * 4 + 1] = v; out0.data[i * 4 + 2] = v; out0.data[i * 4 + 3] = 255;
    }
    c.putImageData(out0, 0, 0);
    return black0 / (S * S);
  }
  // 0b) Via SUAVE (caso comun): lineas buenas + fondo grisaceo. NADA de Sobel:
  // solo punto blanco adaptativo (grises claros -> blanco puro), lineas intactas 1:1.
  const darkFrac = darkN / nSamp;
  if (darkFrac > 0.02 && darkFrac < 0.30) {
    // white-point = percentil 95 (pico del papel), limitado a [0.75, 0.98]
    const vals = [];
    for (let i = 0; i < S * S; i += 11) vals.push(gray[i]);
    vals.sort((a, b) => a - b);
    let wp = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
    wp = Math.max(0.75, Math.min(0.98, wp));
    const outG = c.createImageData(S, S);
    let blackG = 0;
    for (let i = 0; i < S * S; i++) {
      let v = gray[i] / wp;
      if (v > 1) v = 1;
      v = 1 - Math.pow(1 - v, 2.2); // gamma anti-sombras: grises medios -> casi blanco, lineas intactas
      const b8 = Math.round(v * 255);
      if (b8 < 100) blackG++;
      outG.data[i * 4] = b8; outG.data[i * 4 + 1] = b8; outG.data[i * 4 + 2] = b8; outG.data[i * 4 + 3] = 255;
    }
    c.putImageData(outG, 0, 0);
    return blackG / (S * S);
  }
  // 1) Aplanado de fondo (via sombreada): resta el fondo local (blur ancho separable R=10) para
  //    rescatar lineas tenues sobre zonas grises/sombreadas. hp = gris - fondo + 0.5.
  const tmp = new Float32Array(S * S);
  const RB = 10;
  for (let y = 0; y < S; y++) {
    let acc = 0;
    for (let x = -RB; x < S; x++) {
      const add = x + RB < S ? gray[y * S + x + RB] : 0;
      const sub = x - RB - 1 >= 0 ? gray[y * S + x - RB - 1] : 0;
      acc += add - sub;
      if (x >= 0) tmp[y * S + x] = acc / (Math.min(S - 1, x + RB) - Math.max(0, x - RB) + 1);
    }
  }
  for (let x = 0; x < S; x++) {
    let acc = 0;
    for (let y = -RB; y < S; y++) {
      const add = y + RB < S ? tmp[(y + RB) * S + x] : 0;
      const sub = y - RB - 1 >= 0 ? tmp[(y - RB - 1) * S + x] : 0;
      acc += add - sub;
      if (y >= 0) {
        const bg = acc / (Math.min(S - 1, y + RB) - Math.max(0, y - RB) + 1);
        let v = gray[y * S + x] - bg + 0.5;
        gray[y * S + x] = v < 0 ? 0 : (v > 1 ? 1 : v);
      }
    }
  }
  // 1b) Autocontraste (p2-p98): la tinta tenue de la IA llega decidida al detector.
  const sample = [];
  for (let i = 0; i < S * S; i += 7) sample.push(gray[i]);
  sample.sort((a, b) => a - b);
  const p2 = sample[Math.floor(sample.length * 0.02)];
  const p98 = sample[Math.floor(sample.length * 0.98)];
  const span = Math.max(0.05, p98 - p2);
  for (let i = 0; i < S * S; i++) {
    let v = (gray[i] - p2) / span;
    gray[i] = v < 0 ? 0 : (v > 1 ? 1 : v);
  }
  // 2) Desenfoque gaussiano 3x3: quita el "ruido de lapiz gastado" antes de detectar bordes.
  const sm = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let acc = 0, wsum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= S) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= S) continue;
          const w = (dx === 0 && dy === 0) ? 4 : (dx !== 0 && dy !== 0 ? 1 : 2);
          acc += gray[ny * S + nx] * w; wsum += w;
        }
      }
      sm[y * S + x] = acc / wsum;
    }
  }
  // 3) Sobel + magnitud y direccion.
  const mag = new Float32Array(S * S);
  const dir = new Uint8Array(S * S); // 0=h, 1=v, 2=diag\, 3=diag/
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      const gx = -sm[i - S - 1] - 2 * sm[i - 1] - sm[i + S - 1] + sm[i - S + 1] + 2 * sm[i + 1] + sm[i + S + 1];
      const gy = -sm[i - S - 1] - 2 * sm[i - S] - sm[i - S + 1] + sm[i + S - 1] + 2 * sm[i + S] + sm[i + S + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      const a = Math.abs(Math.atan2(gy, gx)) * 180 / Math.PI; // 0..180
      dir[i] = a < 22.5 || a >= 157.5 ? 0 : (a < 67.5 ? 3 : (a < 112.5 ? 1 : 2));
    }
  }
  // 4) NMS (1px, sin dobles) + umbrales ADAPTATIVOS por percentil de cada imagen.
  const nms = new Uint8Array(S * S);
  const mags = [];
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      const m = mag[i];
      if (m <= 0) continue;
      let n1, n2;
      if (dir[i] === 0) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
      else if (dir[i] === 1) { n1 = mag[i - S]; n2 = mag[i + S]; }
      else if (dir[i] === 2) { n1 = mag[i - S - 1]; n2 = mag[i + S + 1]; }
      else { n1 = mag[i - S + 1]; n2 = mag[i + S - 1]; }
      if (m >= n1 && m > n2) { nms[i] = 1; if (((x + y) & 3) === 0) mags.push(m); } // desempate: mesetas quedan en 1px; percentil sobre muestra 1/4 (4x mas rapido, igual distribucion)
    }
  }
  mags.sort((a, b) => b - a);
  const fracHi = bold ? 0.055 : 0.09; // top-% de pixeles que seran linea fuerte
  const thHi = mags.length ? mags[Math.min(mags.length - 1, Math.floor(mags.length * fracHi))] : 0.15;
  const thLo = thHi * 0.35;
  // 5) HISTERESIS: fuerte se queda; debil solo si conecta (8-vecinos) con fuerte.
  //    Rescata trazos tenues conectados (circulos que no cerraban) y mata ruido suelto.
  const kept = new Uint8Array(S * S);
  const stk = [];
  for (let i = 0; i < S * S; i++) {
    if (nms[i] && mag[i] >= thHi) { kept[i] = 1; stk.push(i); }
  }
  while (stk.length) {
    const i = stk.pop();
    const x = i % S, y = (i / S) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= S) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= S) continue;
        const j = ny * S + nx;
        if (!kept[j] && nms[j] && mag[j] >= thLo) { kept[j] = 1; stk.push(j); }
      }
    }
  }
  // 5b) Costura de extremos en 2 pasadas: huecos normales (12px) y grandes (20px
  //    con exigencia alta de enfrentamiento). Cierra ojos/circulos dejados abiertos.
  const sewn = stitchEndpoints(stitchEndpoints(kept, S, 12, 0.25), S, 20, 0.45);
  // 6) Engorde controlado (gruesa y marcada) + CIERRE 2px que puentea micro-cortes.
  const fatR = bold ? 1 : 0;
  let mask = sewn;
  if (fatR > 0) mask = dilateBox(mask, S, fatR);
  mask = closeBox(mask, S, 2);
  // 7) Limpieza final: borra componentes diminutos aislados (<12px, salpicaduras).
  mask = dropSmall(mask, S, 12);
  const out = c.createImageData(S, S);
  let black = 0;
  for (let i = 0; i < S * S; i++) {
    const v = mask[i] ? 0 : 255;
    if (mask[i]) black++;
    out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
  }
  c.putImageData(out, 0, 0);
  return black / (S * S); // proporcion de linea: sirve para medir calidad
}
function dilateBox(m, S, R) {
  const b = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let hit = 0;
      for (let dy = -R; dy <= R && !hit; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= S) continue;
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= S) continue;
          if (m[ny * S + nx]) { hit = 1; break; }
        }
      }
      b[y * S + x] = hit;
    }
  }
  return b;
}
function erodeBox(m, S, R) {
  const b = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let all = 1;
      for (let dy = -R; dy <= R && all; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= S) continue; // fuera = no penaliza (conserva lineas al borde)
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= S) continue;
          if (!m[ny * S + nx]) { all = 0; break; }
        }
      }
      b[y * S + x] = all;
    }
  }
  return b;
}
function closeBox(m, S, R) { return erodeBox(dilateBox(m, S, R), S, R); }
function stitchEndpoints(m, S, maxDist, minDot) {
  if (typeof minDot !== "number") minDot = 0.25;
  // Puntas de linea: pixeles con exactamente 1 vecino-8. Se calcula su tangente
  // caminando unos pasos por la linea, y se unen parejas cercanas cuyas tangentes
  // apunten la una a la otra (arco abierto). Tope de costuras por rendimiento.
  const ends = [];
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      if (!m[i]) continue;
      let nb = 0, nx = x, ny = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (m[(y + dy) * S + (x + dx)]) { nb++; nx = x + dx; ny = y + dy; }
        }
      if (nb !== 1) continue;
      let px = x, py = y, qx = nx, qy = ny;
      for (let s = 0; s < 3; s++) {
        let found = false;
        for (let dy = -1; dy <= 1 && !found; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const ax = qx + dx, ay = qy + dy;
            if ((ax === px && ay === py) || ax < 0 || ay < 0 || ax >= S || ay >= S) continue;
            if (m[ay * S + ax]) { px = qx; py = qy; qx = ax; qy = ay; found = true; break; }
          }
        if (!found) break;
      }
      ends.push({ x: x, y: y, dx: x - qx, dy: y - qy });
    }
  }
  if (ends.length < 2) return m;
  const cell = maxDist;
  const gw = Math.ceil(S / cell);
  const grid = new Array(gw * gw);
  for (let k = 0; k < ends.length; k++) {
    const e = ends[k];
    const gi = Math.min(gw - 1, (e.y / cell) | 0) * gw + Math.min(gw - 1, (e.x / cell) | 0);
    if (!grid[gi]) grid[gi] = [];
    grid[gi].push(k);
  }
  const used = new Uint8Array(ends.length);
  const out = new Uint8Array(m);
  let links = 0;
  for (let k = 0; k < ends.length && links < 2000; k++) {
    if (used[k]) continue;
    const a = ends[k];
    const al = Math.hypot(a.dx, a.dy) || 1;
    const anx = a.dx / al, any = a.dy / al;
    const gxc = Math.min(gw - 1, (a.x / cell) | 0), gyc = Math.min(gw - 1, (a.y / cell) | 0);
    let best = -1, bestD = maxDist + 1;
    for (let cy = Math.max(0, gyc - 1); cy <= Math.min(gw - 1, gyc + 1); cy++) {
      for (let cx = Math.max(0, gxc - 1); cx <= Math.min(gw - 1, gxc + 1); cx++) {
        const arr = grid[cy * gw + cx];
        if (!arr) continue;
        for (let n = 0; n < arr.length; n++) {
          const j = arr[n];
          if (j === k || used[j]) continue;
          const b = ends[j];
          const ddx = b.x - a.x, ddy = b.y - a.y;
          const dd = Math.hypot(ddx, ddy);
          if (dd < 2 || dd > maxDist || dd >= bestD) continue;
          const bl = Math.hypot(b.dx, b.dy) || 1;
          const lx = ddx / dd, ly = ddy / dd;
          if ((anx * lx + any * ly) < minDot) continue; // a no mira a b
          if ((b.dx / bl) * -lx + (b.dy / bl) * -ly < minDot) continue; // b no mira a a
          bestD = dd; best = j;
        }
      }
    }
    if (best >= 0) {
      used[k] = 1; used[best] = 1;
      drawSeg(out, S, a.x, a.y, ends[best].x, ends[best].y);
      links++;
    }
  }
  return out;
}
function drawSeg(m, S, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (let n = 0; n < 500; n++) {
    if (x >= 0 && y >= 0 && x < S && y < S) m[y * S + x] = 1;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function dropSmall(m, S, minSize) {
  const seen = new Uint8Array(S * S);
  const out = new Uint8Array(m);
  const q = [];
  for (let s = 0; s < S * S; s++) {
    if (!m[s] || seen[s]) continue;
    q.length = 0;
    q.push(s); seen[s] = 1;
    const comp = [];
    for (let k = 0; k < q.length; k++) {
      const i = q[k]; comp.push(i);
      const x = i % S, y = (i / S) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= S) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= S) continue;
          const j = ny * S + nx;
          if (m[j] && !seen[j]) { seen[j] = 1; q.push(j); }
        }
      }
    }
    if (comp.length < minSize) for (const i of comp) out[i] = 0;
  }
  return out;
}
