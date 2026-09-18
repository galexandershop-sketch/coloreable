function syncPainterSize(baseCanvas) {
  try {
    var wrap = baseCanvas.parentNode && baseCanvas.parentNode.parentNode;
    var paint = wrap && wrap.querySelector && wrap.querySelector(".paint-layer");
    if (!paint) return;
    if (paint.width !== baseCanvas.width || paint.height !== baseCanvas.height) {
      // Conservar lo ya pintado al redimensionar (caso: clic en "Colorear" antes de terminar line-art).
      var tmp = document.createElement("canvas");
      tmp.width = paint.width; tmp.height = paint.height;
      try { tmp.getContext("2d").drawImage(paint, 0, 0); } catch (e) {}
      paint.width = baseCanvas.width; paint.height = baseCanvas.height;
      var st = paint.__paintState;
      if (st) { st.S.stack = []; st.S.drawing = false; st.S.last = null; }
      try { paint.getContext("2d").drawImage(tmp, 0, 0, paint.width, paint.height); } catch (e2) {}
    }
  } catch (e) {}
}
window.syncPainterSize = syncPainterSize;
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
  // Caja exclusiva para los 2 canvas: la capa de pintura debe alinearse SOLO con el dibujo,
  // nunca con la barra de herramientas (si la cubre, los clics en la paleta pintan en vez de elegir color).
  var stack = document.createElement("div");
  stack.className = "paint-stack";
  // Vista con scroll: al ampliar con zoom el dibujo crece y se recorre con scroll.
  var view = document.createElement("div");
  view.className = "zoom-view";
  wrap.appendChild(view);
  view.appendChild(stack);
  stack.appendChild(baseCanvas);
  var paint = document.createElement("canvas");
  paint.width = baseCanvas.width; paint.height = baseCanvas.height;
  paint.className = "paint-layer";
  stack.appendChild(paint);
  var help = document.createElement("p");
  help.className = "paint-help";
  help.textContent = "Pinta con el dedo o el raton sobre el dibujo. Elige color y grosor abajo.";
  wrap.appendChild(help);
  var pctx = paint.getContext("2d");
  pctx.lineCap = "round"; pctx.lineJoin = "round";
  var PALETTE = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#3498db","#9b59b6","#fd79a8","#6c5ce7","#00cec9","#2d3436","#fdcb9e","#8d5a2b","#95a5a6","#a3e635","#81ecec","#e17055","#fdcb6e","#273c75"];
  var NAMES = { "#e74c3c": "rojo", "#e67e22": "naranja", "#f1c40f": "amarillo", "#2ecc71": "verde", "#3498db": "azul", "#9b59b6": "morado", "#fd79a8": "rosa", "#6c5ce7": "violeta", "#00cec9": "turquesa", "#2d3436": "negro", "#fdcb9e": "piel", "#8d5a2b": "marron", "#95a5a6": "gris", "#a3e635": "lima", "#81ecec": "celeste", "#e17055": "coral", "#fdcb6e": "dorado", "#273c75": "marino" };
  var bar = document.createElement("div");
  bar.className = "paint-bar";
  var html = '<div class="swatches">';
  for (var i = 0; i < PALETTE.length; i++) {
    html += '<button type="button" class="sw" data-c="' + PALETTE[i] + '" style="background:' + PALETTE[i] + '" aria-label="color"></button>';
  }
  html += '</div><div class="cur">Toca un color para cambiarlo. Color actual: <b class="pc">rojo</b></div>';
  html += '<label class="pw">Grosor <input type="range" min="2" max="40" value="12"> <output>12</output></label>';
  html += '<div class="pzoom"><button type="button" data-t="zout" aria-label="Reducir zoom">−</button>' +
    '<button type="button" data-t="zreset" class="pzval" title="Volver a 100%">100%</button>' +
    '<button type="button" data-t="zin" aria-label="Ampliar zoom">+</button>' +
    '<button type="button" data-t="move" title="Arrastrar para mover el dibujo ampliado">✋ Mover</button></div>';
  html += '<div class="ptools"><button type="button" data-t="brush" class="on">🖌️ Pincel</button>' +
    '<button type="button" data-t="fill">🪣 Rellenar</button>' +
    '<button type="button" data-t="eraser">🧽 Borrador</button>' +
    '<button type="button" data-t="undo">↩ Deshacer</button>' +
    '<button type="button" data-t="redo">↪ Rehacer</button>' +
    '<button type="button" data-t="clear">🗑 Limpiar</button>' +
    '<button type="button" data-t="save" class="save">💾 Guardar</button></div>';
  bar.innerHTML = html;
  // Barra SIEMPRE encima del dibujo, a la vista sin hacer scroll.
  // OJO: el canvas ya vive dentro de `stack`, asi que la referencia valida es `stack`
  // (con `baseCanvas` insertBefore lanza NotFoundError y rompe TODO el pintor).
  wrap.insertBefore(bar, view);
  bar.querySelector('.sw[data-c="#e74c3c"]').setAttribute("aria-pressed", "true");
  var S = { color: PALETTE[0], size: 12, tool: "brush", drawing: false, last: null, prevMid: null, stack: [], redo: [], zoomIx: 0, pan: false, panning: false };
  // Estado POR instancia: con "Cantidad: 2/4/6" hay varios dibujos y cada uno debe pintar en su capa.
  var state = { S: S, paint: paint, pctx: pctx, bar: bar, PALETTE: PALETTE, NAMES: NAMES, zoom: 1 };
  // Zoom 1x-4x: se escala el stack completo (base + capa) con CSS; pos() usa
  // getBoundingClientRect asi que las coordenadas de pintura siguen exactas.
  var ZOOMS = [1, 1.25, 1.5, 2, 2.5, 3, 4];
  state.ZOOMS = ZOOMS;
  state.view = view;
  function applyZoom() {
    var z = ZOOMS[S.zoomIx] || 1;
    state.zoom = z;
    stack.style.transform = z === 1 ? "" : "scale(" + z + ")";
    var lbl = bar.querySelector(".pzval");
    if (lbl) lbl.textContent = Math.round(z * 100) + "%";
    var bin = bar.querySelector('[data-t="zin"]');
    var bout = bar.querySelector('[data-t="zout"]');
    if (bin) bin.disabled = S.zoomIx >= ZOOMS.length - 1;
    if (bout) bout.disabled = S.zoomIx <= 0;
    if (z === 1 && S.pan) setPan(false); // a 100% no hace falta mover
    if (state.syncCursor) state.syncCursor();
  }
  function setPan(on) {
    S.pan = !!on;
    var b = bar.querySelector('[data-t="move"]');
    if (b) b.classList.toggle("on", S.pan);
    paint.style.touchAction = S.pan ? "pan-x pan-y" : "none";
    paint.classList.toggle("panning", S.pan);
    if (state.syncCursor) state.syncCursor();
  }
  state.applyZoom = applyZoom;
  state.setPan = setPan;
  paint.__paintState = state;
  bar.__paintState = state;
  window.__paint = state; // compatibilidad (depuracion / ultimo pintor creado)
  var rg = bar.querySelector(".pw input");
  var op = bar.querySelector(".pw output");
  rg.addEventListener("input", function () { S.size = +rg.value; op.textContent = rg.value; if (state.syncCursor) state.syncCursor(); });
  // Anillo del pincel: muestra tamano y color reales siguiendo el mouse.
  var cursor = document.createElement("div");
  cursor.className = "brush-cursor";
  cursor.style.display = "none";
  stack.appendChild(cursor);
  paint.style.cursor = "none";
  function syncCursor() {
    if (S.pan) { cursor.style.display = "none"; paint.style.cursor = "grab"; return; }
    if (S.tool !== "brush" && S.tool !== "eraser") { cursor.style.display = "none"; paint.style.cursor = "pointer"; return; }
    paint.style.cursor = "none";
    var r = paint.getBoundingClientRect();
    // El anillo vive dentro del stack escalado: dividir por zoom para tamano real.
    var z = state.zoom || 1;
    var dd = Math.max(6, S.size * (r.width / Math.max(1, paint.width)) / z);
    cursor.style.display = "block";
    cursor.style.width = dd + "px"; cursor.style.height = dd + "px";
    if (S.tool === "eraser") { cursor.style.border = "2px dashed #888"; cursor.style.background = "rgba(255,255,255,.35)"; }
    else { cursor.style.border = "2.5px solid " + S.color; cursor.style.background = "rgba(255,255,255,.15)"; }
  }
  state.cursor = cursor;
  state.syncCursor = syncCursor;
  paint.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch") { cursor.style.display = "none"; return; }
    var r = paint.getBoundingClientRect();
    var z = state.zoom || 1;
    cursor.style.left = ((e.clientX - r.left) / z) + "px";
    cursor.style.top = ((e.clientY - r.top) / z) + "px";
    if (S.tool === "brush" || S.tool === "eraser") syncCursor();
  });
  paint.addEventListener("pointerleave", function () { cursor.style.display = "none"; });
  return { paint: paint, base: baseCanvas };
}
window.attachPainter = attachPainter;
(function () {
  var active = null; // estado de la capa que se esta pintando ahora mismo
  function pos(e, st) {
    var paint = st.paint;
    var r = paint.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (paint.width / Math.max(1, r.width)), y: (e.clientY - r.top) * (paint.height / Math.max(1, r.height)) };
  }
  function push(st) {
    st.S.redo = []; // accion nueva: se pierde lo rehecho
    try {
      st.S.stack.push(st.pctx.getImageData(0, 0, st.paint.width, st.paint.height));
      if (st.S.stack.length > 25) st.S.stack.shift();
    } catch (e) {}
  }
  // Trazo suavizado: curva cuadratica por puntos medios + puntos intermedios
  // del navegador (coalesced) + presion del lapiz. Se siente fluido, sin angulos.
  function strokeTo(st, c, pressure) {
    var S = st.S, p = st.pctx;
    var pr = (pressure && pressure > 0) ? (0.4 + 0.6 * pressure) : 1;
    p.save();
    p.globalCompositeOperation = S.tool === "eraser" ? "destination-out" : "source-over";
    p.strokeStyle = S.color; p.lineWidth = Math.max(1, S.size * pr);
    var mid = { x: (S.last.x + c.x) / 2, y: (S.last.y + c.y) / 2 };
    p.beginPath();
    if (S.prevMid) p.moveTo(S.prevMid.x, S.prevMid.y);
    else p.moveTo(S.last.x, S.last.y);
    p.quadraticCurveTo(S.last.x, S.last.y, mid.x, mid.y);
    p.stroke();
    p.restore();
    S.prevMid = mid; S.last = c;
  }
  function paintStatus(msg) {
    try {
      var s = document.getElementById("status");
      if (s) { s.textContent = msg; s.className = "err"; }
    } catch (e2) {}
  }
  // Relleno en 2 niveles (+ rescate de cuadritos). Nivel fino (useDilated=false,
  // tope 60%) respeta cuadritos; si se fuga, reintento sellado (tope 95%: un fondo
  // legitimo grande tambien pinta); si aun asi falla, rescate por presupuesto.
  // Devuelve {status:'ok'|'leak'|'nowall'|'onwall'|'same'|'error', n}.
  function doFill(st, sx, sy, color, useDilated, capFrac) {
    if (typeof capFrac !== "number") capFrac = 0.6;
    var p = st;
    var W = p.paint.width, H = p.paint.height;
    // 1) Leer la capa de pintura (donde escribimos).
    var img;
    try { img = p.pctx.getImageData(0, 0, W, H); }
    catch (e) { return { status: "error", n: 0 }; }
    var d = img.data;
    // 2) Leer el dibujo base para usar sus LINEAS como paredes.
    var wall = null, block = null;
    try {
      var base = p.paint.parentNode && p.paint.parentNode.querySelector("canvas.base-cv");
      if (base && base.width && base.height) {
        var bW = base.width, bH = base.height, bd;
        if (bW === W && bH === H) {
          bd = base.getContext("2d").getImageData(0, 0, W, H).data;
        } else {
          // Tamaños distintos (clic rapido antes del line-art): reescalar a offscreen.
          var off = document.createElement("canvas");
          off.width = W; off.height = H;
          var oc = off.getContext("2d");
          oc.fillStyle = "#fff"; oc.fillRect(0, 0, W, H);
          oc.drawImage(base, 0, 0, W, H);
          bd = oc.getImageData(0, 0, W, H).data;
        }
        wall = new Uint8Array(W * H);
        for (var w = 0; w < W * H; w++) {
          var lum = (bd[w * 4] * 0.299 + bd[w * 4 + 1] * 0.587 + bd[w * 4 + 2] * 0.114);
          wall[w] = lum < 128 ? 1 : 0; // 1 = linea = no pintar encima
        }
        // Muros dilatados 3px para sellar micro-huecos (solo nivel sellado).
        block = new Uint8Array(W * H);
        var R = 3;
        for (var yy = 0; yy < H; yy++) {
          for (var xx = 0; xx < W; xx++) {
            var hit = 0;
            for (var dy = -R; dy <= R && !hit; dy++) {
              var ny = yy + dy;
              if (ny < 0 || ny >= H) continue;
              for (var dx = -R; dx <= R; dx++) {
                var nx = xx + dx;
                if (nx < 0 || nx >= W) continue;
                if (wall[ny * W + nx]) { hit = 1; break; }
              }
            }
            block[yy * W + xx] = hit;
          }
        }
      }
    } catch (e2) { wall = null; block = null; /* canvas contaminado por CORS */ }
    // Sin muros legibles NO inundar (antes pintaba TODA la pagina de un color plano).
    if (!wall) return { status: "nowall", n: 0 };
    var r0 = parseInt(color.slice(1, 3), 16), g0 = parseInt(color.slice(3, 5), 16), b0 = parseInt(color.slice(5, 7), 16);
    var si = (sy * W + sx) * 4;
    // Toque sobre linea real: no hacer nada.
    if (wall[sy * W + sx]) return { status: "onwall", n: 0 };
    var tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
    // Si ya es del mismo color, no hacer nada.
    if (ta === 255 && tr === r0 && tg === g0 && tb === b0) return { status: "same", n: 0 };
    var barrier = useDilated ? block : wall; // fino = solo lineas reales
    var tol = 90;
    var seen = new Uint8Array(W * H);
    var stk = [sx, sy];
    seen[sy * W + sx] = 1;
    var n = 0;
    while (stk.length) {
      var y = stk.pop(), x = stk.pop();
      var idx = y * W + x;
      if (barrier[idx]) continue; // muro: no cruzar
      var i = idx * 4;
      var dr = Math.abs(d[i] - tr), dg = Math.abs(d[i + 1] - tg), db = Math.abs(d[i + 2] - tb);
      var da = Math.abs(d[i + 3] - ta);
      if (dr + dg + db + da > tol) continue;
      d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; d[i + 3] = 255; n++;
      if (n > (W * H * capFrac)) return { status: "leak", n: n }; // fuga: no aplicar
      if (x > 0 && !seen[idx - 1]) { seen[idx - 1] = 1; stk.push(x - 1, y); }
      if (x < W - 1 && !seen[idx + 1]) { seen[idx + 1] = 1; stk.push(x + 1, y); }
      if (y > 0 && !seen[idx - W]) { seen[idx - W] = 1; stk.push(x, y - 1); }
      if (y < H - 1 && !seen[idx + W]) { seen[idx + W] = 1; stk.push(x, y + 1); }
    }
    // Pegar el relleno a la linea real (sin cruzarla) para no dejar halo blanco.
    for (var e = 0; e < 3; e++) {
      for (var yy2 = 0; yy2 < H; yy2++) {
        for (var xx2 = 0; xx2 < W; xx2++) {
          var id2 = yy2 * W + xx2;
          if (wall[id2] || d[id2 * 4 + 3] === 255) continue;
          var touch = false;
          if (xx2 > 0 && d[(id2 - 1) * 4 + 3] === 255) touch = true;
          else if (xx2 < W - 1 && d[(id2 + 1) * 4 + 3] === 255) touch = true;
          else if (yy2 > 0 && d[(id2 - W) * 4 + 3] === 255) touch = true;
          else if (yy2 < H - 1 && d[(id2 + W) * 4 + 3] === 255) touch = true;
          if (touch) { d[id2 * 4] = r0; d[id2 * 4 + 1] = g0; d[id2 * 4 + 2] = b0; d[id2 * 4 + 3] = 255; n++; }
        }
      }
    }
    p.pctx.putImageData(img, 0, 0);
    return { status: "ok", n: n };
  }
  // Tercer nivel: BFS con muros finos y PRESUPUESTO (1500px). Pinta cuadritos
  // diminutos aunque el sellado los tape por completo; si agota el presupuesto
  // es que la zona esta abierta de verdad -> leak.
  function doFillBudget(st, sx, sy, color) {
    var p = st;
    var W = p.paint.width, H = p.paint.height;
    var img;
    try { img = p.pctx.getImageData(0, 0, W, H); }
    catch (e) { return { status: "error", n: 0 }; }
    var d = img.data;
    var wall = null;
    try {
      var base = p.paint.parentNode && p.paint.parentNode.querySelector("canvas.base-cv");
      if (base && base.width === W && base.height === H) {
        var bd = base.getContext("2d").getImageData(0, 0, W, H).data;
        wall = new Uint8Array(W * H);
        for (var w = 0; w < W * H; w++) {
          var lum = (bd[w * 4] * 0.299 + bd[w * 4 + 1] * 0.587 + bd[w * 4 + 2] * 0.114);
          wall[w] = lum < 128 ? 1 : 0;
        }
      }
    } catch (e2) { wall = null; }
    if (!wall) return { status: "nowall", n: 0 };
    var r0 = parseInt(color.slice(1, 3), 16), g0 = parseInt(color.slice(3, 5), 16), b0 = parseInt(color.slice(5, 7), 16);
    var si = (sy * W + sx) * 4;
    if (wall[sy * W + sx]) return { status: "onwall", n: 0 };
    var tr = d[si], tg = d[si + 1], tb = d[si + 2], ta = d[si + 3];
    if (ta === 255 && tr === r0 && tg === g0 && tb === b0) return { status: "same", n: 0 };
    var BUDGET = 1500;
    var seen = new Uint8Array(W * H);
    var q = [sx, sy], head = 0; // cola BFS: pinta lo cercano primero
    seen[sy * W + sx] = 1;
    var n = 0;
    while (head < q.length) {
      var x = q[head], y = q[head + 1]; head += 2;
      var idx = y * W + x;
      if (wall[idx]) continue;
      var i = idx * 4;
      var dr = Math.abs(d[i] - tr), dg = Math.abs(d[i + 1] - tg), db = Math.abs(d[i + 2] - tb);
      var da = Math.abs(d[i + 3] - ta);
      if (dr + dg + db + da > 90) continue;
      d[i] = r0; d[i + 1] = g0; d[i + 2] = b0; d[i + 3] = 255; n++;
      if (n > BUDGET) return { status: "leak", n: n };
      if (x > 0 && !seen[idx - 1]) { seen[idx - 1] = 1; q.push(x - 1, y); }
      if (x < W - 1 && !seen[idx + 1]) { seen[idx + 1] = 1; q.push(x + 1, y); }
      if (y > 0 && !seen[idx - W]) { seen[idx - W] = 1; q.push(x, y - 1); }
      if (y < H - 1 && !seen[idx + W]) { seen[idx + W] = 1; q.push(x, y + 1); }
    }
    for (var e = 0; e < 3; e++) {
      for (var yy2 = 0; yy2 < H; yy2++) {
        for (var xx2 = 0; xx2 < W; xx2++) {
          var id2 = yy2 * W + xx2;
          if (wall[id2] || d[id2 * 4 + 3] === 255) continue;
          var touch = false;
          if (xx2 > 0 && d[(id2 - 1) * 4 + 3] === 255) touch = true;
          else if (xx2 < W - 1 && d[(id2 + 1) * 4 + 3] === 255) touch = true;
          else if (yy2 > 0 && d[(id2 - W) * 4 + 3] === 255) touch = true;
          else if (yy2 < H - 1 && d[(id2 + W) * 4 + 3] === 255) touch = true;
          if (touch) { d[id2 * 4] = r0; d[id2 * 4 + 1] = g0; d[id2 * 4 + 2] = b0; d[id2 * 4 + 3] = 255; n++; }
        }
      }
    }
    p.pctx.putImageData(img, 0, 0);
    return { status: "ok", n: n };
  }
  document.addEventListener("pointerdown", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("paint-layer")) return;
    var st = t.__paintState || window.__paint;
    if (!st) return;
    active = st;
    // Modo Mover: arrastrar desplaza el scroll en vez de pintar (recorrer el zoom).
    if (st.S.pan) {
      st.S.panning = true;
      var vw = st.view || null;
      st.S.panStart = { x: e.clientX, y: e.clientY, sl: vw ? vw.scrollLeft : 0, st2: vw ? vw.scrollTop : 0 };
      try { t.setPointerCapture(e.pointerId); } catch (err) {}
      return; // sin preventDefault: el tactil usa scroll nativo
    }
    e.preventDefault();
    try { t.setPointerCapture(e.pointerId); } catch (err) {}
    var q = pos(e, st);
    var ix = Math.max(0, Math.min(st.paint.width - 1, Math.round(q.x)));
    var iy = Math.max(0, Math.min(st.paint.height - 1, Math.round(q.y)));
    if (st.S.tool === "fill") {
      var snap = null;
      try { snap = st.pctx.getImageData(0, 0, st.paint.width, st.paint.height); } catch (eSnap) {}
      var r1 = doFill(st, ix, iy, st.S.color, false, 0.6); // nivel fino: respeta cuadritos
      if (r1.status === "ok") {
        if (snap) { st.S.stack.push(snap); if (st.S.stack.length > 25) st.S.stack.shift(); }
      } else {
        if (snap) { try { st.pctx.putImageData(snap, 0, 0); } catch (eRs) {} }
        if (r1.status === "nowall" || r1.status === "error") {
          paintStatus("Relleno no disponible en este dibujo (no se pudo leer el line-art). Usa el pincel.");
        } else if (r1.status === "onwall") {
          paintStatus("Tocaste una linea: toca dentro de la zona a pintar.");
        } else if (r1.status === "leak") {
          var r2 = doFill(st, ix, iy, st.S.color, true, 0.95); // reintento sellado (fondos grandes OK)
          if (r2.status === "ok" && r2.n >= 4) {
            if (snap) { st.S.stack.push(snap); if (st.S.stack.length > 25) st.S.stack.shift(); }
          } else {
            if (snap) { try { st.pctx.putImageData(snap, 0, 0); } catch (eRs2) {} }
            var r3 = doFillBudget(st, ix, iy, st.S.color); // cuadrito diminuto tapado por el sello
            if (r3.status === "ok") {
              if (snap) { st.S.stack.push(snap); if (st.S.stack.length > 25) st.S.stack.shift(); }
            } else {
              if (snap) { try { st.pctx.putImageData(snap, 0, 0); } catch (eRs3) {} }
              paintStatus("Esa zona esta abierta: repasa el borde con el pincel o pintala a mano.");
            }
          }
        }
      }
      return;
    }
    push(st);
    st.S.drawing = true; st.S.last = q; st.S.prevMid = null;
    st.pctx.save();
    st.pctx.globalCompositeOperation = st.S.tool === "eraser" ? "destination-out" : "source-over";
    st.pctx.fillStyle = st.S.color;
    // El punto inicial usa LA MISMA presion que el trazo (el mouse reporta 0.5):
    // antes salia a tamano completo y la linea mas fina -> se veia una "bola".
    var pr0 = (e.pressure && e.pressure > 0) ? (0.4 + 0.6 * e.pressure) : 1;
    st.pctx.beginPath(); st.pctx.arc(q.x, q.y, Math.max(0.5, (st.S.size * pr0) / 2), 0, 6.3); st.pctx.fill();
    st.pctx.restore();
  }, true);
  document.addEventListener("pointermove", function (e) {
    if (!active) return;
    if (active.S.panning) {
      var vw2 = active.view;
      var ps = active.S.panStart;
      if (vw2 && ps) { vw2.scrollLeft = ps.sl - (e.clientX - ps.x); vw2.scrollTop = ps.st2 - (e.clientY - ps.y); }
      return;
    }
    e.preventDefault();
    var evts = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
    if (!evts.length) evts = [e];
    for (var k = 0; k < evts.length; k++) {
      strokeTo(active, pos(evts[k], active), evts[k].pressure);
    }
  }, true);
  ["pointerup", "pointercancel"].forEach(function (t) {
    document.addEventListener(t, function () {
      if (active) { active.S.drawing = false; active.S.last = null; active.S.prevMid = null; active.S.panning = false; }
      active = null;
    }, true);
  });
})();
(function () {
  document.addEventListener("click", function (e) {
    var bar = e.target.closest ? e.target.closest(".paint-bar") : null;
    if (!bar) return;
    var p = bar.__paintState || window.__paint;
    if (!p) return;
    var sw = e.target.closest ? e.target.closest(".sw") : null;
    if (sw) {
      var all = bar.querySelectorAll(".sw");
      for (var k = 0; k < all.length; k++) all[k].removeAttribute("aria-pressed");
      sw.setAttribute("aria-pressed", "true");
      p.S.color = sw.getAttribute("data-c");
      // NO tocar p.S.tool: cambiar de color en modo Rellenar/Borrador te sacaba a Pincel.
      bar.querySelector(".pc").textContent = p.NAMES[p.S.color] || p.S.color;
      if (p.syncCursor) p.syncCursor();
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
      if (p.syncCursor) p.syncCursor();
    } else if (t === "zin" || t === "zout" || t === "zreset") {
      var zs = p.ZOOMS || [1];
      if (t === "zin") p.S.zoomIx = Math.min(zs.length - 1, (p.S.zoomIx || 0) + 1);
      else if (t === "zout") p.S.zoomIx = Math.max(0, (p.S.zoomIx || 0) - 1);
      else p.S.zoomIx = 0;
      if (p.applyZoom) p.applyZoom();
    } else if (t === "move") {
      if (p.setPan) p.setPan(!p.S.pan);
    } else if (t === "undo") {
      var prev = p.S.stack.pop();
      if (prev) {
        try { p.S.redo.push(p.pctx.getImageData(0, 0, p.paint.width, p.paint.height)); } catch (err) {}
        try { p.pctx.putImageData(prev, 0, 0); } catch (err2) {}
      }
    } else if (t === "redo") {
      var nxt = p.S.redo.pop();
      if (nxt) {
        try { p.S.stack.push(p.pctx.getImageData(0, 0, p.paint.width, p.paint.height)); } catch (err) {}
        try { p.pctx.putImageData(nxt, 0, 0); } catch (err2) {}
      }
    } else if (t === "clear") {
      try {
        p.S.stack.push(p.pctx.getImageData(0, 0, p.paint.width, p.paint.height));
        p.S.redo = [];
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
