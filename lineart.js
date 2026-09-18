// lineart.js — pipeline compartido: proxy + Sobel line-art + morfologia.
// Lo usan index (app.js) y las paginas SEO (seo-page.js). Sin dependencias.

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
            const ar = im2.width / im2.height || 1;
            const W = ar >= 1 ? 768 : Math.max(1, Math.round(768 * ar));
            const H = ar >= 1 ? Math.max(1, Math.round(768 / ar)) : 768;
            cv.width = W; cv.height = H;
            const c2 = cv.getContext("2d");
            c2.fillStyle = "#fff"; c2.fillRect(0, 0, W, H);
            c2.drawImage(im2, 0, 0, W, H);
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
  // Lienzo con la PROPORCION real de la imagen (lado largo 768): sin bandas,
  // sin deformar y sin perder resolucion en formatos no cuadrados.
  const ar = img.width / img.height || 1;
  const W = ar >= 1 ? 768 : Math.max(1, Math.round(768 * ar));
  const H = ar >= 1 ? Math.max(1, Math.round(768 / ar)) : 768;
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const o = off.getContext("2d");
  o.drawImage(img, 0, 0, W, H);
  const id = o.getImageData(0, 0, W, H);
  const d = id.data;
  const gray = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    gray[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  }
  // 0) Analisis: si la IA ya devolvio line-art limpio (casi todo blanco y negro),
  //    NO se usa Sobel: el detector de bordes duplica cada trazo fino y empasta
  //    las masas (medido: 11% tinta real -> 28% empastada). Via directa: umbral.
  let midN = 0, darkN = 0;
  for (let i = 0; i < W * H; i += 7) {
    const g = gray[i];
    if (g >= 0.157 && g <= 0.823) midN++;
    if (g < 0.39) darkN++;
  }
  const nSamp = Math.ceil(W * H / 7);
  if (midN / nSamp < 0.08 && darkN / nSamp > 0.02 && darkN / nSamp < 0.22) {
    let cm = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) if (gray[i] < 0.667) cm[i] = 1;
    cm = closeBox(cm, W, H, 1);
    cm = dropSmall(cm, W, H, 12);
    if (bold) cm = dilateBox(cm, W, H, 1); // trazo grueso marcado
    const out0 = c.createImageData(W, H);
    let black0 = 0;
    for (let i = 0; i < W * H; i++) {
      const v = cm[i] ? 0 : 255;
      if (cm[i]) black0++;
      out0.data[i * 4] = v; out0.data[i * 4 + 1] = v; out0.data[i * 4 + 2] = v; out0.data[i * 4 + 3] = 255;
    }
    c.putImageData(out0, 0, 0);
    return black0 / (W * H);
  }
  // 0b) Via SUAVE (caso comun): lineas buenas + fondo grisaceo. NADA de Sobel:
  // solo punto blanco adaptativo (grises claros -> blanco puro), lineas intactas 1:1.
  const darkFrac = darkN / nSamp;
  if (darkFrac > 0.02 && darkFrac < 0.30) {
    // white-point = percentil 95 (pico del papel), limitado a [0.75, 0.98]
    const vals = [];
    for (let i = 0; i < W * H; i += 11) vals.push(gray[i]);
    vals.sort((a, b) => a - b);
    let wp = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
    wp = Math.max(0.75, Math.min(0.98, wp));
    const outG = c.createImageData(W, H);
    let blackG = 0;
    for (let i = 0; i < W * H; i++) {
      let v = gray[i] / wp;
      if (v > 1) v = 1;
      v = 1 - Math.pow(1 - v, 2.2); // gamma anti-sombras: grises medios -> casi blanco, lineas intactas
      const b8 = Math.round(v * 255);
      if (b8 < 100) blackG++;
      outG.data[i * 4] = b8; outG.data[i * 4 + 1] = b8; outG.data[i * 4 + 2] = b8; outG.data[i * 4 + 3] = 255;
    }
    c.putImageData(outG, 0, 0);
    return blackG / (W * H);
  }
  // 1) Aplanado de fondo (via sombreada): resta el fondo local (blur ancho separable R=10) para
  //    rescatar lineas tenues sobre zonas grises/sombreadas. hp = gris - fondo + 0.5.
  const tmp = new Float32Array(W * H);
  const RB = 10;
  for (let y = 0; y < H; y++) {
    let acc = 0;
    for (let x = -RB; x < W; x++) {
      const add = x + RB < W ? gray[y * W + x + RB] : 0;
      const sub = x - RB - 1 >= 0 ? gray[y * W + x - RB - 1] : 0;
      acc += add - sub;
      if (x >= 0) tmp[y * W + x] = acc / (Math.min(W - 1, x + RB) - Math.max(0, x - RB) + 1);
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -RB; y < H; y++) {
      const add = y + RB < H ? tmp[(y + RB) * W + x] : 0;
      const sub = y - RB - 1 >= 0 ? tmp[(y - RB - 1) * W + x] : 0;
      acc += add - sub;
      if (y >= 0) {
        const bg = acc / (Math.min(H - 1, y + RB) - Math.max(0, y - RB) + 1);
        let v = gray[y * W + x] - bg + 0.5;
        gray[y * W + x] = v < 0 ? 0 : (v > 1 ? 1 : v);
      }
    }
  }
  // 1b) Autocontraste (p2-p98): la tinta tenue de la IA llega decidida al detector.
  const sample = [];
  for (let i = 0; i < W * H; i += 7) sample.push(gray[i]);
  sample.sort((a, b) => a - b);
  const p2 = sample[Math.floor(sample.length * 0.02)];
  const p98 = sample[Math.floor(sample.length * 0.98)];
  const span = Math.max(0.05, p98 - p2);
  for (let i = 0; i < W * H; i++) {
    let v = (gray[i] - p2) / span;
    gray[i] = v < 0 ? 0 : (v > 1 ? 1 : v);
  }
  // 2) Desenfoque gaussiano 3x3: quita el "ruido de lapiz gastado" antes de detectar bordes.
  const sm = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let acc = 0, wsum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const w = (dx === 0 && dy === 0) ? 4 : (dx !== 0 && dy !== 0 ? 1 : 2);
          acc += gray[ny * W + nx] * w; wsum += w;
        }
      }
      sm[y * W + x] = acc / wsum;
    }
  }
  // 3) Sobel + magnitud y direccion.
  const mag = new Float32Array(W * H);
  const dir = new Uint8Array(W * H); // 0=h, 1=v, 2=diag\, 3=diag/
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -sm[i - W - 1] - 2 * sm[i - 1] - sm[i + W - 1] + sm[i - W + 1] + 2 * sm[i + 1] + sm[i + W + 1];
      const gy = -sm[i - W - 1] - 2 * sm[i - W] - sm[i - W + 1] + sm[i + W - 1] + 2 * sm[i + W] + sm[i + W + 1];
      mag[i] = Math.sqrt(gx * gx + gy * gy);
      const a = Math.abs(Math.atan2(gy, gx)) * 180 / Math.PI; // 0..180
      dir[i] = a < 22.5 || a >= 157.5 ? 0 : (a < 67.5 ? 3 : (a < 112.5 ? 1 : 2));
    }
  }
  // 4) NMS (1px, sin dobles) + umbrales ADAPTATIVOS por percentil de cada imagen.
  const nms = new Uint8Array(W * H);
  const mags = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const m = mag[i];
      if (m <= 0) continue;
      let n1, n2;
      if (dir[i] === 0) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
      else if (dir[i] === 1) { n1 = mag[i - W]; n2 = mag[i + W]; }
      else if (dir[i] === 2) { n1 = mag[i - W - 1]; n2 = mag[i + W + 1]; }
      else { n1 = mag[i - W + 1]; n2 = mag[i + W - 1]; }
      if (m >= n1 && m > n2) { nms[i] = 1; if (((x + y) & 3) === 0) mags.push(m); } // desempate: mesetas quedan en 1px; percentil sobre muestra 1/4 (4x mas rapido, igual distribucion)
    }
  }
  mags.sort((a, b) => b - a);
  const fracHi = bold ? 0.055 : 0.09; // top-% de pixeles que seran linea fuerte
  const thHi = mags.length ? mags[Math.min(mags.length - 1, Math.floor(mags.length * fracHi))] : 0.15;
  const thLo = thHi * 0.35;
  // 5) HISTERESIS: fuerte se queda; debil solo si conecta (8-vecinos) con fuerte.
  //    Rescata trazos tenues conectados (circulos que no cerraban) y mata ruido suelto.
  const kept = new Uint8Array(W * H);
  const stk = [];
  for (let i = 0; i < W * H; i++) {
    if (nms[i] && mag[i] >= thHi) { kept[i] = 1; stk.push(i); }
  }
  while (stk.length) {
    const i = stk.pop();
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= H) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= W) continue;
        const j = ny * W + nx;
        if (!kept[j] && nms[j] && mag[j] >= thLo) { kept[j] = 1; stk.push(j); }
      }
    }
  }
  // 5b) Costura de extremos en 2 pasadas: huecos normales (12px) y grandes (20px
  //    con exigencia alta de enfrentamiento). Cierra ojos/circulos dejados abiertos.
  const sewn = stitchEndpoints(stitchEndpoints(kept, W, H, 12, 0.25), W, H, 20, 0.45);
  // 6) Engorde controlado (gruesa y marcada) + CIERRE 2px que puentea micro-cortes.
  const fatR = bold ? 1 : 0;
  let mask = sewn;
  if (fatR > 0) mask = dilateBox(mask, W, H, fatR);
  mask = closeBox(mask, W, H, 2);
  // 7) Limpieza final: borra componentes diminutos aislados (<12px, salpicaduras).
  mask = dropSmall(mask, W, H, 12);
  const out = c.createImageData(W, H);
  let black = 0;
  for (let i = 0; i < W * H; i++) {
    const v = mask[i] ? 0 : 255;
    if (mask[i]) black++;
    out.data[i * 4] = v; out.data[i * 4 + 1] = v; out.data[i * 4 + 2] = v; out.data[i * 4 + 3] = 255;
  }
  c.putImageData(out, 0, 0);
  return black / (W * H); // proporcion de linea: sirve para medir calidad
}
function dilateBox(m, W, H, R) {
  const b = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let hit = 0;
      for (let dy = -R; dy <= R && !hit; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          if (m[ny * W + nx]) { hit = 1; break; }
        }
      }
      b[y * W + x] = hit;
    }
  }
  return b;
}
function erodeBox(m, W, H, R) {
  const b = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let all = 1;
      for (let dy = -R; dy <= R && all; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue; // fuera = no penaliza (conserva lineas al borde)
        for (let dx = -R; dx <= R; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          if (!m[ny * W + nx]) { all = 0; break; }
        }
      }
      b[y * W + x] = all;
    }
  }
  return b;
}
function closeBox(m, W, H, R) { return erodeBox(dilateBox(m, W, H, R), W, H, R); }
function stitchEndpoints(m, W, H, maxDist, minDot) {
  if (typeof minDot !== "number") minDot = 0.25;
  // Puntas de linea: pixeles con exactamente 1 vecino-8. Se calcula su tangente
  // caminando unos pasos por la linea, y se unen parejas cercanas cuyas tangentes
  // apunten la una a la otra (arco abierto). Tope de costuras por rendimiento.
  const ends = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (!m[i]) continue;
      let nb = 0, nx = x, ny = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (m[(y + dy) * W + (x + dx)]) { nb++; nx = x + dx; ny = y + dy; }
        }
      if (nb !== 1) continue;
      let px = x, py = y, qx = nx, qy = ny;
      for (let s = 0; s < 3; s++) {
        let found = false;
        for (let dy = -1; dy <= 1 && !found; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const ax = qx + dx, ay = qy + dy;
            if ((ax === px && ay === py) || ax < 0 || ay < 0 || ax >= W || ay >= H) continue;
            if (m[ay * W + ax]) { px = qx; py = qy; qx = ax; qy = ay; found = true; break; }
          }
        if (!found) break;
      }
      ends.push({ x: x, y: y, dx: x - qx, dy: y - qy });
    }
  }
  if (ends.length < 2) return m;
  const cell = maxDist;
  const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
  const grid = new Array(gw * gh);
  for (let k = 0; k < ends.length; k++) {
    const e = ends[k];
    const gi = Math.min(gh - 1, (e.y / cell) | 0) * gw + Math.min(gw - 1, (e.x / cell) | 0);
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
    const gxc = Math.min(gw - 1, (a.x / cell) | 0), gyc = Math.min(gh - 1, (a.y / cell) | 0);
    let best = -1, bestD = maxDist + 1;
    for (let cy = Math.max(0, gyc - 1); cy <= Math.min(gh - 1, gyc + 1); cy++) {
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
      drawSeg(out, W, H, a.x, a.y, ends[best].x, ends[best].y);
      links++;
    }
  }
  return out;
}
function drawSeg(m, W, H, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (let n = 0; n < 500; n++) {
    if (x >= 0 && y >= 0 && x < W && y < H) m[y * W + x] = 1;
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}
function dropSmall(m, W, H, minSize) {
  const seen = new Uint8Array(W * H);
  const out = new Uint8Array(m);
  const q = [];
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || seen[s]) continue;
    q.length = 0;
    q.push(s); seen[s] = 1;
    const comp = [];
    for (let k = 0; k < q.length; k++) {
      const i = q[k]; comp.push(i);
      const x = i % W, y = (i / W) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= W) continue;
          const j = ny * W + nx;
          if (m[j] && !seen[j]) { seen[j] = 1; q.push(j); }
        }
      }
    }
    if (comp.length < minSize) for (const i of comp) out[i] = 0;
  }
  return out;
}
