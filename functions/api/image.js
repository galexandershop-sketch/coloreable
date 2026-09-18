// Cloudflare Pages Function: GET /api/image?url=https://...png
// Equivalente al serverless de Vercel en api/image.js, en sintaxis Workers.
// Sirve de proxy CORS para cargar imagenes y hacer Sobel -> line-art en el navegador.
const MAX_BYTES = 8 * 1024 * 1024; // tope anti-abuso: line-art trabaja a 768px, mas es desperdicio
const REF_OK = /localhost|127\.0\.0\.1|coloreable|vercel\.app|pages\.dev/i;

function hostOf(v) {
  try { return new URL(v).hostname.toLowerCase(); } catch (e) { return ""; }
}

export async function onRequest(context) {
  const reqUrl = new URL(context.request.url);
  // Anti-abuso: el proxy solo sirve a paginas del propio sitio.
  // Se acepta el mismo host (cubre dominios personalizados) + dominios conocidos.
  const ref = context.request.headers.get("referer") || context.request.headers.get("origin") || "";
  if (hostOf(ref) !== reqUrl.hostname.toLowerCase() && !REF_OK.test(ref)) {
    return Response.json({ error: "origen no permitido" }, { status: 403 });
  }
  const u = reqUrl.searchParams.get("url");

  // La IA puede devolver URLs sin extension: no se filtra por extension,
  // se valida esquema https y despues el content-type real.
  if (!u || !/^https:\/\/[^\s"'<>]+$/i.test(u)) {
    return Response.json({ error: "url invalida" }, { status: 400 });
  }

  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) {
      return Response.json({ error: "origen " + r.status }, { status: 502 });
    }
    const len = parseInt(r.headers.get("content-length") || "0", 10);
    if (len > MAX_BYTES) {
      return Response.json({ error: "imagen muy grande" }, { status: 413 });
    }
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      return Response.json({ error: "imagen muy grande" }, { status: 413 });
    }
    const ct = r.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(ct)) {
      return Response.json({ error: "no es imagen" }, { status: 502 });
    }
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    if (e && e.name === "TimeoutError") {
      return Response.json({ error: "origen tardo demasiado" }, { status: 504 });
    }
    return Response.json({ error: "proxy: fallo interno" }, { status: 500 });
  }
}
