/* Editor de coloreado: pincel + borrador + deshacer + paleta + guardar */
function attachPainter(baseCanvas, opts) {
  opts = opts || {};
  const wrap = document.createElement("div");
  wrap.className = "painter";
  baseCanvas.replaceWith(wrap);
  wrap.appendChild(baseCanvas);

  const paint = document.createElement("canvas");
  paint.width = baseCanvas.width; paint.height = baseCanvas.height;
  paint.className = "paint-layer";
  wrap.appendChild(paint);
  const pctx = paint.getContext("2d");
  pctx.lineCap = "round"; pctx.lineJoin = "round";

  const PALETTE = ["#e74c3c","#e67e22","#f1c40f","#2ecc71","#3498db","#9b59b6","#fd79a8","#6c5ce7","#00cec9","#2d3436"];
  const bar = document.createElement("div");
  bar.className = "paint-bar";
  bar.innerHTML =
    '<div class="swatches">' + PALETTE.map((c, i) =>
      '<button class="sw" data-c="' + c + '" style="background:' + c + '"' + (i === 0 ? ' aria-pressed="true"' : "") + '></button>'
    ).join("") + "</div>" +
    '<label class="pw">Grosor <input type="range" min="2" max="40" value="10"></label>' +
    '<div class="ptools"><button data-t="brush" class="on">Pincel</button>' +
    '<button data-t="eraser">Borrador</button>' +
    '<button data-t="undo">Deshacer</button>' +
    '<button data-t="clear">Limpiar</button>' +
    '<button data-t="save" class="save">Guardar</button></div>';
  wrap.appendChild(bar);

  const S = {
    color: PALETTE[0], size: 10, tool: "brush",
    drawing: false, last: null, stack: [],
  };
  const push = () => {
    S.stack.push(pctx.getImageData(0, 0, paint.width, paint.height));
    if (S.stack.length > 25) S.stack.shift();
  };
  const pos = e => {
    const r = paint.getBoundingClientRect();
    const t = (e.touches && e.touches[0]) || e;
    return {
      x: (t.clientX - r.left) * (paint.width / r.width),
      y: (t.clientY - r.top) * (paint.height / r.height),
    };
  };
  const stroke = (a, b) => {
    pctx.save();
    pctx.globalCompositeOperation = S.tool === "eraser" ? "destination-out" : "source-over";
    pctx.strokeStyle = S.color; pctx.lineWidth = S.size;
    pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(b.x, b.y); pctx.stroke();
    pctx.restore();
  };
  paint.addEventListener("pointerdown", e => {
    e.preventDefault(); paint.setPointerCapture(e.pointerId);
    push(); S.drawing = true; S.last = pos(e);
    pctx.save();
    pctx.globalCompositeOperation = S.tool === "eraser" ? "destination-out" : "source-over";
    pctx.fillStyle = S.color;
    pctx.beginPath(); pctx.arc(S.last.x, S.last.y, S.size / 2, 0, 7); pctx.fill();
    pctx.restore();
  });
  paint.addEventListener("pointermove", e => {
    if (!S.drawing) return;
    e.preventDefault();
    const p = pos(e); stroke(S.last, p); S.last = p;
  });
  const stop = () => { S.drawing = false; S.last = null; };
  paint.addEventListener("pointerup", stop);
  paint.addEventListener("pointercancel", stop);
  bar.addEventListener("click", e => {
    const sw = e.target.closest(".sw");
    if (sw) {
      bar.querySelectorAll(".sw").forEach(b => b.removeAttribute("aria-pressed"));
      sw.setAttribute("aria-pressed", "true");
      S.color = sw.dataset.c; S.tool = "brush";
      bar.querySelector('[data-t="brush"]').classList.add("on");
      bar.querySelector('[data-t="eraser"]').classList.remove("on");
      return;
    }
    const b = e.target.closest("button[data-t]");
    if (!b) return;
    const t = b.dataset.t;
    if (t === "brush" || t === "eraser") {
      S.tool = t;
      bar.querySelector('[data-t="brush"]').classList.toggle("on", t === "brush");
      bar.querySelector('[data-t="eraser"]').classList.toggle("on", t === "eraser");
    } else if (t === "undo") {
      const prev = S.stack.pop();
      if (prev) pctx.putImageData(prev, 0, 0);
    } else if (t === "clear") {
      push(); pctx.clearRect(0, 0, paint.width, paint.height);
    } else if (t === "save") {
      const out = document.createElement("canvas");
      out.width = baseCanvas.width; out.height = baseCanvas.height;
      const o = out.getContext("2d");
      o.drawImage(baseCanvas, 0, 0);
      o.drawImage(paint, 0, 0);
      const a = document.createElement("a");
      a.href = out.toDataURL("image/png");
      a.download = "coloreado-" + Date.now() + ".png";
      a.click();
      if (opts.onSave) opts.onSave();
    }
  });
  bar.querySelector(".pw input").addEventListener("input", e => { S.size = +e.target.value; });
  return { canvas: paint, base: baseCanvas };
}
window.attachPainter = attachPainter;
