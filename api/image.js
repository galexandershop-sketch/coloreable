const MAX_BYTES = 8 * 1024 * 1024; // tope anti-abuso: line-art trabaja a 768px, mas es desperdicio
const REF_OK = /localhost|127\.0\.0\.1|coloreable|vercel\.app|pages\.dev/i;

function hostOf(v) {
  try { return new URL(v).hostname.toLowerCase(); } catch (e) { return ""; }
}

export default async function handler(req, res) {
  // Anti-abuso: el proxy solo sirve a paginas del propio sitio.
  // Se acepta el mismo host (cubre dominios personalizados) + dominios conocidos.
  const ref = req.headers.referer || req.headers.origin || "";
  const host = String(req.headers.host || "").toLowerCase();
  if ((hostOf(ref) !== host || !host) && !REF_OK.test(ref)) {
    return res.status(403).json({ error: "origen no permitido" });
  }
  const u = req.query.url;
  // La IA puede devolver URLs sin extension: no se filtra por extension,
  // se valida esquema https y despues el content-type real.
  if (!u || !/^https:\/\/[^\s"'<>]+$/i.test(u)) {
    return res.status(400).json({ error: "url invalida" });
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 20000);
    let r;
    try {
      r = await fetch(u, { signal: ctl.signal });
    } finally {
      clearTimeout(t);
    }
    if (!r.ok) return res.status(502).json({ error: "origen " + r.status });
    const len = parseInt(r.headers.get("content-length") || "0", 10);
    if (len > MAX_BYTES) return res.status(413).json({ error: "imagen muy grande" });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: "imagen muy grande" });
    const ct = r.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(ct)) return res.status(502).json({ error: "no es imagen" });
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buf);
  } catch (e) {
    if (e && e.name === "AbortError") return res.status(504).json({ error: "origen tardo demasiado" });
    return res.status(500).json({ error: "proxy: fallo interno" });
  }
}
