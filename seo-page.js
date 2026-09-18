// seo-page.js — runtime de las paginas SEO (/dibujos-de-X-para-colorear).
// Genera 6 dibujos al visitar (API + lineArt de lineart.js), imprime y descarga.
// Sin dependencias salvo lineart.js (cargado antes). Sin inline handlers (CSP).
(function () {
  var API = "https://death-image.ashlynn.workers.dev/generate";
  function $(id) { return document.getElementById(id); }
  function status(m, err) {
    var s = $("seo-status");
    if (s) { s.textContent = m || ""; s.className = err ? "err" : ""; }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function cfg() {
    try { return JSON.parse($("seo-data").textContent); }
    catch (e) { return { topic: "", slug: "dibujo", prompts: [] }; }
  }
  function recipe(user) {
    return "coloring book page, " + user + ", black and white line art, bold outlines, thick lines, no shading, no gray, no color, white background, simple shapes, minimalist, centered, full page, for kids";
  }
  async function fetchGen(prompt, timeoutMs) {
    var ctl = new AbortController();
    var t = setTimeout(function () { ctl.abort(); }, timeoutMs);
    try {
      var r = await fetch(API + "?" + new URLSearchParams({ prompt: recipe(prompt), image: "1", dimensions: "1:1", steps: "12", safety: "true" }).toString(), { signal: ctl.signal });
      if (!r.ok) throw new Error("API " + r.status);
      var d = await r.json();
      if (d.error) throw new Error(d.error);
      var imgs = d.images || [];
      if (!imgs.length) throw new Error("Sin imagenes.");
      return imgs;
    } catch (e) {
      if (e && e.name === "AbortError") throw new Error("Timeout: la API tardo demasiado.");
      throw e;
    } finally { clearTimeout(t); }
  }
  async function genWithRetry(prompt) {
    var waits = [0, 1500, 3000], last = null;
    for (var a = 0; a < 3; a++) {
      if (waits[a]) await sleep(waits[a]);
      try { return await fetchGen(prompt, 90000); }
      catch (e) {
        last = e;
        var m = String((e && e.message) || "");
        if (/API 4\d\d/.test(m) && !/429/.test(m)) throw e;
      }
    }
    throw last;
  }
  async function fillFigure(fig, prompt, caption) {
    var cv = fig.querySelector("canvas");
    var cap = fig.querySelector("figcaption");
    if (cap) cap.textContent = "Creando dibujo...";
    var imgs = await genWithRetry(prompt);
    await lineArt(imgs[0], cv, true);
    if (cap) cap.textContent = caption;
  }
  function failFigure(fig, prompt, caption) {
    fig.classList.add("seo-fail");
    var b = document.createElement("button");
    b.className = "btn-mini alt"; b.type = "button"; b.textContent = "Reintentar";
    b.onclick = function () {
      b.remove(); fig.classList.remove("seo-fail");
      fillFigure(fig, prompt, caption).catch(function () { failFigure(fig, prompt, caption); });
    };
    fig.appendChild(b);
  }
  async function boot(C) {
    var figs = Array.prototype.slice.call(document.querySelectorAll("#seo-grid figure"));
    if (!figs.length) return;
    status("Creando tus dibujos... (unos segundos)");
    var i = 0, ok = 0, fail = 0;
    async function worker() {
      while (i < figs.length) {
        var idx = i++;
        var fig = figs[idx];
        var p = C.prompts[idx] || C.prompts[0];
        try {
          await fillFigure(fig, p, "Dibujo " + (idx + 1) + " de " + C.topic + " para colorear");
          ok++;
        } catch (e) { fail++; failFigure(fig, p, "Dibujo " + (idx + 1) + " de " + C.topic + " para colorear"); }
      }
    }
    var ws = [];
    for (var k = 0; k < Math.min(3, figs.length); k++) ws.push(worker());
    await Promise.all(ws);
    if (fail) status("Listo: " + ok + " dibujos." + (fail ? " (" + fail + " fallaron, dale Reintentar)" : ""), fail > 0);
    else status("");
  }
  function canvases() {
    return Array.prototype.slice.call(document.querySelectorAll("#seo-grid canvas"))
      .filter(function (cv) { return cv.width > 0; });
  }
  function printWhenReady(sheet) {
    var cleaned = false;
    var cleanup = function () {
      if (cleaned) return; cleaned = true;
      document.body.classList.remove("printing-sheet");
      var sh = document.getElementById("printSheet");
      if (sh) sh.remove();
      try { window.onafterprint = null; } catch (e) {}
    };
    try { window.onafterprint = function () { cleanup(); }; } catch (e) {}
    var imgs = sheet.querySelectorAll("img");
    var pending = imgs.length, printed = false;
    var doPrint = function () {
      if (printed) return; printed = true;
      clearTimeout(waitTo);
      status("");
      try { window.focus(); window.print(); }
      catch (e) { cleanup(); status("No se pudo abrir la impresión.", true); return; }
      setTimeout(cleanup, 120000);
    };
    if (!pending) { doPrint(); return; }
    status("Preparando hoja de impresión...");
    var waitTo = setTimeout(doPrint, 4000);
    var watch = function (im) {
      var done = false;
      var one = function () {
        if (done) return; done = true;
        pending--;
        if (pending <= 0) doPrint();
      };
      if (im.complete && im.naturalWidth > 0) { one(); return; }
      im.addEventListener("load", one);
      im.addEventListener("error", one);
      if (im.decode) { try { im.decode().then(one, one); } catch (e) {} }
    };
    for (var k = 0; k < imgs.length; k++) watch(imgs[k]);
  }
  function printAll() {
    var cvs = canvases();
    if (!cvs.length) { status("Aún no hay dibujos listos, espera unos segundos.", true); return; }
    var srcs = [];
    for (var i = 0; i < cvs.length; i++) {
      try { srcs.push(cvs[i].toDataURL("image/png")); } catch (e) {}
    }
    if (!srcs.length) { status("No se pudieron leer los dibujos.", true); return; }
    var old = document.getElementById("printSheet");
    if (old) old.remove();
    document.body.classList.remove("printing-sheet");
    var sheet = document.createElement("div");
    sheet.id = "printSheet"; sheet.className = "ps-half"; // 6 dibujos: 2 por hoja
    srcs.forEach(function (s, n) {
      var fig = document.createElement("figure");
      var im = document.createElement("img");
      im.src = s; im.alt = "Dibujo " + (n + 1) + " para colorear";
      fig.appendChild(im); sheet.appendChild(fig);
    });
    document.body.appendChild(sheet);
    document.body.classList.add("printing-sheet");
    printWhenReady(sheet);
  }
  async function downloadAll(C) {
    var cvs = canvases();
    if (!cvs.length) { status("Aún no hay dibujos listos, espera unos segundos.", true); return; }
    if (window.JSZip) {
      try {
        status("Armando ZIP con " + cvs.length + " dibujos...");
        var zip = new window.JSZip(), n = 0;
        for (var i = 0; i < cvs.length; i++) {
          var url = "";
          try { url = cvs[i].toDataURL("image/png"); } catch (e) { continue; }
          var b64 = url.split(",")[1];
          if (!b64) continue;
          n++;
          zip.file(C.slug + "-" + String(n).padStart(2, "0") + ".png", b64, { base64: true });
        }
        if (!n) throw new Error("vacio");
        var blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = C.slug + ".zip";
        document.body.appendChild(a); a.click();
        setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} a.remove(); }, 5000);
        status("ZIP listo en tu carpeta de descargas.");
        return;
      } catch (e) { /* cae al plan B */ }
    }
    status("Descargando uno por uno...");
    var j = 0;
    for (var k = 0; k < cvs.length; k++) {
      try {
        var a2 = document.createElement("a");
        a2.href = cvs[k].toDataURL("image/png");
        a2.download = C.slug + "-" + (++j) + ".png";
        document.body.appendChild(a2); a2.click(); a2.remove();
      } catch (e) {}
      await sleep(400);
    }
    status("Descarga lista: " + j + " dibujos.");
  }
  document.addEventListener("DOMContentLoaded", function () {
    var C = cfg();
    var bp = $("seo-print"), bd = $("seo-dl");
    if (bp) bp.onclick = printAll;
    if (bd) bd.onclick = function () { downloadAll(C); };
    boot(C);
  });
})();
