// Cloudflare Pages Function: GET /api/image?url=https://...png
// Equivalente al serverless de Vercel en api/image.js, en sintaxis Workers.
// Sirve de proxy CORS para cargar imagenes y hacer Sobel -> line-art en el navegador.
export async function onRequest(context) {
  const reqUrl = new URL(context.request.url);
  const u = reqUrl.searchParams.get("url");

  if (!u || !/^https:\/\/.+\.(png|jpg|jpeg|webp)(\?.*)?$/i.test(u)) {
    return Response.json({ error: "url invalida" }, { status: 400 });
  }

  try {
    const r = await fetch(u);
    if (!r.ok) {
      return Response.json({ error: "origen " + r.status }, { status: 502 });
    }
    const buf = await r.arrayBuffer();
    const ct = r.headers.get("content-type") || "image/png";
    return new Response(buf, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return Response.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
