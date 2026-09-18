export default async function handler(req, res) {
  const u = req.query.url;
  if (!u || !/^https:\/\/.+\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(u)) {
    return res.status(400).json({ error: "url invalida" });
  }
  try {
    const r = await fetch(u);
    if (!r.ok) return res.status(502).json({ error: "origen " + r.status });
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") || "image/png";
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(buf);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
