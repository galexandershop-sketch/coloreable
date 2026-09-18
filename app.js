const API = "https://death-image.ashlynn.workers.dev/generate";
const $ = id => document.getElementById(id);
const IDEAS = ["dinosaurio astronauta","unicornio en las nubes","gato pirata","dragon bebe","cohete a la luna","perro bombero","castillo de princesa","tiburon surfero","robot amigable","mariposa gigante","camion de bomberos","sirena en el mar"];
const CATS = ["dinosaurios","unicornios","animales","princesas","superheroes","vehiculos","navidad","halloween","espacio","oceano","granja","profesiones"];
function status(m, err) { const s = $("status"); s.textContent = m; s.className = err ? "err" : ""; }
$("steps").oninput = () => { $("stepsVal").textContent = $("steps").value; };
$("chips").innerHTML = IDEAS.slice(0, 8).map(i => '<button class="chip">' + i + '</button>').join("");
$("chips").onclick = e => { if (e.target.classList.contains("chip")) { $("prompt").value = e.target.textContent; gen(); } };
$("cats").innerHTML = CATS.map(c => '<button>dibujos de ' + c + ' para colorear</button>').join("");
$("cats").onclick = e => { if (e.target.tagName === "BUTTON") { $("prompt").value = e.target.textContent.replace("dibujos de ", "").replace(" para colorear", ""); gen(); window.scrollTo({ top: 0, behavior: "smooth" }); } };
$("surprise").onclick = () => { $("prompt").value = IDEAS[Math.floor(Math.random() * IDEAS.length)]; gen(); };
let made = parseInt(localStorage.getItem("made") || "0");
const paintCount = () => { $("count-made").textContent = made ? (made + " dibujos creados") : ""; };
paintCount();
function coloringPrompt(user) {
  return "black and white coloring book page for kids, bold thick outlines, simple shapes, no shading, no gray, white background, " + user + ", cute kawaii style, centered, full page";
}
async function gen() {
  const btn = $("gen");
  const raw = $("prompt").value.trim();
  if (!raw) { status("Escribe que quieres colorear.", true); return; }
  btn.disabled = true;
  $("result").innerHTML = '<div class="skel"></div>';
  try {
    status("Creando tu dibujo... (unos segundos)");
    const params = { prompt: coloringPrompt(raw), image: $("count").value, dimensions: $("ratio").value, steps: $("steps").value, safety: "true" };
    const r = await fetch(API + "?" + new URLSearchParams(params).toString());
    if (!r.ok) throw new Error("API " + r.status);
    const d = await r.json();
    if (d.error) throw new Error(d.error);
    const imgs = d.images || [];
    if (!imgs.length) throw new Error("Sin imagenes.");
    status("");
    $("result").innerHTML = "";
    const bold = $("style").value === "bold";
    for (const u of imgs) {
      const card = document.createElement("div");
      card.className = "page";
      card.innerHTML = "<h3>" + raw.slice(0, 40) + "</h3>";
      const cv = document.createElement("canvas");
      card.appendChild(cv);
      const row = document.createElement("div");
      row.className = "actions";
      const bPrint = document.createElement("button"); bPrint.className = "btn-mini"; bPrint.textContent = "Imprimir";
      const bDown = document.createElement("button"); bDown.className = "btn-mini alt"; bDown.textContent = "Descargar";
      row.append(bPrint, bDown);
      card.appendChild(row);
      $("result").appendChild(card);
      await lineArt(u, cv, bold, raw);
      bPrint.onclick = () => printOne(cv);
      bDown.onclick = () => { const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = "colorear-" + Date.now() + ".png"; a.click(); };
    }
    made += imgs.length;
    localStorage.setItem("made", made);
    paintCount();
  } catch (e) { status("Error: " + e.message, true); $("result").innerHTML = ""; }
  finally { btn.disabled = false; }
}
$("gen").onclick = gen;
function printOne(cv) {
  const w = window.open("", "_blank");
  w.document.write('<html><head><title>Colorear</title><style>body{margin:0;display:flex;justify-content:center}img{width:100%;max-width:800px}</style></head><body><img src="' + cv.toDataURL("image/png") + '" onload="window.print();"></body></html>');
  w.document.close();
}
// Carga via proxy propio (/api/image) para evitar CORS, luego Sobel -> line-art.
function lineArt(url, cv, bold, label) {
  const proxied = "/api/image?url=" + encodeURIComponent(url);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        paintLineArt(img, cv, bold);
        resolve();
      } catch (e) { reject(new Error("Fallo line-art: " + e.message)); }
    };
    img.onerror = () => {
      // Ultimo recurso: mostrar original en <img> (sin canvas, sin descargar)
      try {
        const holder = document.createElement("img");
        holder.src = url;
        holder.referrerPolicy = "no-referrer";
        holder.style.width = "100%";
        holder.style.borderRadius = "10px";
        cv.replaceWith(holder);
        resolve();
      } catch (e) { reject(new Error("No se pudo cargar la imagen. Reintenta.")); }
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
  const out = c.createImageData(S, S);
  const th = bold ? 0.18 : 0.12;
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      const i = y * S + x;
      const gx = -gray[i - S - 1] - 2 * gray[i - 1] - gray[i + S - 1] + gray[i - S + 1] + 2 * gray[i + 1] + gray[i + S + 1];
      const gy = -gray[i - S - 1] - 2 * gray[i - S] - gray[i - S + 1] + gray[i + S - 1] + 2 * gray[i + S] + gray[i + S + 1];
      const v = Math.sqrt(gx * gx + gy * gy) > th ? 0 : 255;
      out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
    }
  }
  c.putImageData(out, 0, 0);
}
