function attachPainter(baseCanvas, opts) {
  opts = opts || {};
  if (!baseCanvas || !baseCanvas.width) return null;
  if (!baseCanvas.parentNode) return null; // canvas fuera del DOM (fallback <img>): no pintar
  if (baseCanvas.dataset.paint === "1") return null;
  baseCanvas.dataset.paint = "1";
  baseCanvas.classList.add("base-cv");
  var wrap = document.createElement("div");
  wrap.className = "painter";
  baseCanvas.parentNode.insertBefore(wrap, baseCanvas);
  wrap.appendChild(baseCanvas);
  var paint = document.createElement("canvas");
  paint.width = baseCanvas.width; paint.height = baseCanvas.height;
  paint.className = "paint-layer";
  wrap.appendChild(paint);
  var help = document.createElement("p");
  help.className = "paint-help";
  help.textContent = "Pinta con el dedo o el raton sobre el dibujo. Elige color y grosor abajo.";
  wrap.appendChild(help);
  var pctx = paint.getContext("2d");
  pctx.lineCap = "round"; pctx.lineJoin = "round";
  var PALETTE = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#3498db","#9b59b6","#fd79a8","#6c5ce7","#00cec9","#2d3436"];
  var NAMES = { "#e74c3c": "rojo", "#e67e22": "naranja", "#f1c40f": "amarillo", "#2ecc71": "verde", "#3498db": "azul", "#9b59b6": "morado", "#fd79a8": "rosa", "#6c5ce7": "violeta", "#00cec9": "turquesa", "#2d3436": "negro" };
  var bar = document.createElement("div");
  bar.className = "paint-bar";
  var html = '<div class="swatches">';
  for (var i = 0; i < PALETTE.length; i++) {
    html += '<button type="button" class="sw" data-c="' + PALETTE[i] + '" style="background:' + PALETTE[i] + '" aria-label="color"></button>';
  }
  html += '</div><div class="cur">Toca un color para cambiarlo. Color actual: <b class="pc">rojo</b></div>';
  html += '<label class="pw">Grosor <input type="range" min="2" max="40" value="12"> <output>12</output></label>';
  html += '<div class="ptools"><button type="button" data-t="brush" class="on">Pincel</button>' +
    '<button type="button" data-t="fill">Rellenar</button>' +
    '<button type="button" data-t="eraser">Borrador</button>' +
    '<button type="button" data-t="undo">Deshacer</button>' +
    '<button type="button" data-t="clear">Limpiar</button>' +
    '<button type="button" data-t="save" class="save">Guardar</button></div>';
  bar.innerHTML = html;
  // Barra SIEMPRE encima del dibujo, a la vista sin hacer scroll.
  wrap.insertBefore(bar, baseCanvas);
  bar.querySelector('.sw[data-c="#e74c3c"]').setAttribute("aria-pressed", "true");
  var S = { color: PALETTE[0], size: 12, tool: "brush", drawing: false, last: null, stack: [] };
  window.__paint = { S: S, paint: paint, pctx: pctx, bar: bar, PALETTE: PALETTE, NAMES: NAMES };
  var rg = bar.querySelector(".pw input");
  var op = bar.querySelector(".pw output");
  rg.addEventListener("input", function () { S.size = +rg.value; op.textContent = rg.value; });
  return { paint: paint, base: baseCanvas };
}
window.attachPainter = attachPainter;
(function () {
  function P() { return window.__paint; }
  function pos(e) {
    var paint = P().paint;
    var r = paint.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (paint.width / Math.max(1, r.width)), y: (e.clientY - r.top) * (paint.height / Math.max(1, r.height)) };
  }
  function push() {
    var p = P();
    try {
      p.S.stack.push(p.pctx.getImageData(0, 0, p.paint.width, p.paint.height));
      if (p.S.stack.length > 25) p.S.stack.shift();
    } catch (e) {}
  }
  function stroke(a, b) {
    var p = P();
    p.pctx.save();
    p.pctx.globalCompositeOperation = p.S.tool === "eraser" ? "destination-out" : "source-over";
    p.pctx.strokeStyle = p.S.color; p.pctx.lineWidth = p.S.size;
    p.pctx.beginPath(); p.pctx.moveTo(a.x, a.y); p.pctx.lineTo(b.x, b.y); p.pctx.stroke();
    p.pctx.restore();
  }
  function flood(sx, sy, color) {
    var p = P();
    var W = p.paint.width, H = p.paint.height;
    var img = p.pctx.getImageData(0, 0, W, H);
    var d = img.data;
    var r0 = parseInt(color.slice(1, 3), 16), g0 = parseInt(color.slice(3, 5), 16), b0 = parseInt(color.slice(5, 7), 16);
    var si = (sy * W + sx) * 4;
    var tr = d[si], tg = d[si + 1], tb = d[si + 2];
    var tol = 90;
    var seen = new Uint8Array(W * H);
    var st = [sx, sy];
    seen[sy * W + sx] = 1;
    while (st.length) {
      var y = st.pop(), x = st.pop();
      var i = (y * W + x) * 4;
      var dr = Math.abs(d[i] - tr), dg = Math.abs(d[i + 1] - tg), db = Math.abs(d[i + 2] - tb);
      if (dr + dg + db > tol) continue;
      d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; d[i + 3] = 255;
      if (x > 0 && !seen[y * W + x - 1]) { seen[y * W + x - 1] = 1; st.push(x - 1, y); }
      if (x < W - 1 && !seen[y * W + x + 1]) { seen[y * W + x + 1] = 1; st.push(x + 1, y); }
      if (y > 0 && !seen[(y - 1) * W + x]) { seen[(y - 1) * W + x] = 1; st.push(x, y - 1); }
      if (y < H - 1 && !seen[(y + 1) * W + x]) { seen[(y + 1) * W + x] = 1; st.push(x, y + 1); }
    }
    p.pctx.putImageData(img, 0, 0);
  }
  document.addEventListener("pointerdown", function (e) {
    var p = P();
    if (!p || !e.target.classList || !e.target.classList.contains("paint-layer")) return;
    e.preventDefault();
    try { e.target.setPointerCapture(e.pointerId); } catch (err) {}
    var q = pos(e);
    var ix = Math.max(0, Math.min(p.paint.width - 1, Math.round(q.x)));
    var iy = Math.max(0, Math.min(p.paint.height - 1, Math.round(q.y)));
    if (p.S.tool === "fill") { push(); flood(ix, iy, p.S.color); return; }
    push();
    p.S.drawing = true; p.S.last = q;
    p.pctx.save();
    p.pctx.globalCompositeOperation = p.S.tool === "eraser" ? "destination-out" : "source-over";
    p.pctx.fillStyle = p.S.color;
    p.pctx.beginPath(); p.pctx.arc(q.x, q.y, p.S.size / 2, 0, 6.3); p.pctx.fill();
    p.pctx.restore();
  }, true);
  document.addEventListener("pointermove", function (e) {
    var p = P();
    if (!p || !p.S.drawing) return;
    e.preventDefault();
    var q = pos(e); stroke(p.S.last, q); p.S.last = q;
  }, true);
  ["pointerup", "pointercancel"].forEach(function (t) {
    document.addEventListener(t, function () { var p = P(); if (p) { p.S.drawing = false; p.S.last = null; } }, true);
  });
})();
(function () {
  document.addEventListener("click", function (e) {
    var bar = e.target.closest ? e.target.closest(".paint-bar") : null;
    if (!bar || !window.__paint) return;
    var p = window.__paint;
    var sw = e.target.closest ? e.target.closest(".sw") : null;
    if (sw) {
      var all = bar.querySelectorAll(".sw");
      for (var k = 0; k < all.length; k++) all[k].removeAttribute("aria-pressed");
      sw.setAttribute("aria-pressed", "true");
      p.S.color = sw.getAttribute("data-c");
      p.S.tool = "brush";
      bar.querySelector('[data-t="brush"]').classList.add("on");
      bar.querySelector('[data-t="eraser"]').classList.remove("on");
      bar.querySelector('[data-t="fill"]').classList.remove("on");
      bar.querySelector(".pc").textContent = p.NAMES[p.S.color] || p.S.color;
      return;
    }
    var b = e.target.closest ? e.target.closest("button[data-t]") : null;
    if (!b) return;
    var t = b.getAttribute("data-t");
    if (t === "brush" || t === "eraser" || t === "fill") {
      p.S.tool = t;
      bar.querySelector('[data-t="brush"]').classList.toggle("on", t === "brush");
      bar.querySelector('[data-t="eraser"]').classList.toggle("on", t === "eraser");
      bar.querySelector('[data-t="fill"]').classList.toggle("on", t === "fill");
    } else if (t === "undo") {
      var prev = p.S.stack.pop();
      if (prev) { try { p.pctx.putImageData(prev, 0, 0); } catch (err) {} }
    } else if (t === "clear") {
      try {
        p.S.stack.push(p.pctx.getImageData(0, 0, p.paint.width, p.paint.height));
      } catch (err) {}
      p.pctx.clearRect(0, 0, p.paint.width, p.paint.height);
    } else if (t === "save") {
      var base = p.paint.parentNode.querySelector("canvas.base-cv");
      var out = document.createElement("canvas");
      out.width = p.paint.width; out.height = p.paint.height;
      var o = out.getContext("2d");
      o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height);
      try {
        if (base) o.drawImage(base, 0, 0);
        o.drawImage(p.paint, 0, 0);
        var a = document.createElement("a");
        a.href = out.toDataURL("image/png");
        a.download = "coloreado-" + Date.now() + ".png";
        document.body.appendChild(a); a.click(); a.remove();
      } catch (err) {
        // canvas base contaminado (CORS): guardar solo la capa pintada
        try {
          var a2 = document.createElement("a");
          a2.href = p.paint.toDataURL("image/png");
          a2.download = "coloreado-" + Date.now() + ".png";
          document.body.appendChild(a2); a2.click(); a2.remove();
        } catch (e2) { alert("No se pudo guardar. Intenta captura de pantalla."); }
      }
    }
  });
})();
