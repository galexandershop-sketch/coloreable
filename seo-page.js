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
  // Textos UI por idioma (vienen en seo-data; estos son el fallback en español).
  var STR = {
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
  };
  function T(k, vars) {
    var s = STR[k] || "";
    if (vars) for (var key in vars) s = s.split("{" + key + "}").join(vars[key]);
    return s;
  }
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
    if (cap) cap.textContent = T("creating_one");
    var imgs = await genWithRetry(prompt);
    await lineArt(imgs[0], cv, true);
    if (cap) cap.textContent = caption;
  }
  function failFigure(fig, prompt, caption) {
    if (fig.querySelector(".seo-again")) {
      var cap = fig.querySelector("figcaption");
      if (cap) cap.textContent = T("fail_hint");
      return;
    }
    fig.classList.add("seo-fail");
    var b = document.createElement("button");
    b.className = "btn-mini alt"; b.type = "button"; b.textContent = T("retry");
    b.onclick = function () {
      b.remove(); fig.classList.remove("seo-fail");
      fillFigure(fig, prompt, caption).catch(function () { failFigure(fig, prompt, caption); });
    };
    fig.appendChild(b);
  }
  async function boot(C) {
    var figs = Array.prototype.slice.call(document.querySelectorAll("#seo-grid figure"));
    if (!figs.length) return;
    status(T("creating"));
    var i = 0, ok = 0, fail = 0;
    async function worker() {
      while (i < figs.length) {
        var idx = i++;
        var fig = figs[idx];
        var p = C.prompts[idx] || C.prompts[0];
        var capT = T("drawing_n", { n: idx + 1, t: C.topic });
        try {
          await fillFigure(fig, p, capT);
          ok++;
        } catch (e) { fail++; failFigure(fig, p, capT); }
      }
    }
    var ws = [];
    for (var k = 0; k < Math.min(3, figs.length); k++) ws.push(worker());
    await Promise.all(ws);
    if (fail) status(T("partial", { ok: ok, fail: fail }), fail > 0);
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
      catch (e) { cleanup(); status(T("print_fail"), true); return; }
      setTimeout(cleanup, 120000);
    };
    if (!pending) { doPrint(); return; }
    status(T("print_wait"));
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
    if (!cvs.length) { status(T("wait"), true); return; }
    var srcs = [];
    for (var i = 0; i < cvs.length; i++) {
      try { srcs.push(cvs[i].toDataURL("image/png")); } catch (e) {}
    }
    if (!srcs.length) { status(T("unreadable"), true); return; }
    openPrintSizeDialog(srcs);
  }
  // Dialogo de tamano (1, 2 o 4 por hoja), igual que en la app principal.
  function openPrintSizeDialog(srcs) {
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;background:rgba(43,33,24,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px";
    var box = document.createElement("div");
    box.style.cssText = "background:#fffdf8;border-radius:14px;max-width:430px;width:100%;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.3);color:#2b2118";
    var h = document.createElement("h3");
    h.textContent = srcs.length > 1 ? T("print_n", { n: srcs.length }) : T("print_1");
    h.style.margin = "0 0 10px";
    box.appendChild(h);
    var fs = document.createElement("div");
    fs.style.margin = "0 0 10px";
    var t = document.createElement("div");
    t.textContent = T("size_title");
    t.style.fontWeight = "700"; t.style.marginBottom = "4px";
    fs.appendChild(t);
    [[ "full", T("size_full") ], [ "half", T("size_half") ], [ "quad", T("size_quad") ]].forEach(function (o) {
      var lab = document.createElement("label");
      lab.style.display = "block"; lab.style.margin = "4px 0"; lab.style.cursor = "pointer";
      var r = document.createElement("input");
      r.type = "radio"; r.name = "psize"; r.value = o[0];
      if (o[0] === "half") r.checked = true;
      lab.appendChild(r);
      lab.appendChild(document.createTextNode(" " + o[1]));
      fs.appendChild(lab);
    });
    box.appendChild(fs);
    var tip = document.createElement("p");
    tip.style.cssText = "font-size:.82rem;color:#8a7a6a;margin:6px 0 12px";
    tip.textContent = T("tip");
    box.appendChild(tip);
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px;justify-content:flex-end";
    var bC = document.createElement("button"); bC.className = "btn-ghost"; bC.textContent = T("cancel");
    var bP = document.createElement("button"); bP.className = "btn-primary"; bP.textContent = T("print");
    row.append(bC, bP); box.appendChild(row);
    ov.appendChild(box); document.body.appendChild(ov);
    bC.onclick = function () { ov.remove(); };
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) ov.remove(); });
    bP.onclick = function () {
      var sel = box.querySelector('input[name="psize"]:checked');
      var size = sel ? sel.value : "half";
      ov.remove();
      launchSheet(srcs, size);
    };
  }
  function launchSheet(srcs, size) {
    var old = document.getElementById("printSheet");
    if (old) old.remove();
    document.body.classList.remove("printing-sheet");
    var sheet = document.createElement("div");
    sheet.id = "printSheet";
    sheet.className = size === "quad" ? "ps-quad" : (size === "half" ? "ps-half" : "ps-full");
    if (size === "quad") {
      var wrap = document.createElement("div");
      wrap.className = "pwrap";
      srcs.forEach(function (s, n) {
        var im = document.createElement("img");
        im.src = s; im.alt = T("img_alt", { n: n + 1 });
        wrap.appendChild(im);
      });
      sheet.appendChild(wrap);
    } else {
      srcs.forEach(function (s, n) {
        var fig = document.createElement("figure");
      var im = document.createElement("img");
      im.src = s; im.alt = T("img_alt", { n: n + 1 });
      fig.appendChild(im); sheet.appendChild(fig);
      });
    }
    document.body.appendChild(sheet);
    document.body.classList.add("printing-sheet");
    printWhenReady(sheet);
  }
  async function downloadAll(C) {
    var cvs = canvases();
    if (!cvs.length) { status(T("wait"), true); return; }
    if (window.JSZip) {
      try {
        status(T("zip_build", { n: cvs.length }));
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
        status(T("zip_done"));
        return;
      } catch (e) { /* cae al plan B */ }
    }
    status(T("dl_one"));
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
    status(T("dl_done", { n: j }));
  }
  document.addEventListener("DOMContentLoaded", function () {
    var C = cfg();
    if (C.ui) for (var k in C.ui) STR[k] = C.ui[k];
    PAGE = C;
    var bp = $("seo-print"), bd = $("seo-dl");
    if (bp) bp.onclick = printAll;
    if (bd) bd.onclick = function () { downloadAll(C); };
    boot(C);
  });
  // "🔄 Otra versión" por figura: regenera solo ese dibujo (la API da uno nuevo).
  var PAGE = null;
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".seo-again") : null;
    if (!b || b.disabled || !PAGE) return;
    var fig = b.closest ? b.closest("figure") : null;
    if (!fig) return;
    var i = +(b.getAttribute("data-i") || 0);
    var p = PAGE.prompts[i] || PAGE.prompts[0];
    var caption = T("drawing_n", { n: i + 1, t: PAGE.topic });
    b.disabled = true;
    var oldT = b.textContent; b.textContent = "...";
    fig.classList.remove("seo-fail");
    fillFigure(fig, p, caption).catch(function () { failFigure(fig, p, caption); })
      .then(function () { b.disabled = false; b.textContent = oldT; });
  });
})();
