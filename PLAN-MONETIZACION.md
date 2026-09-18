# Plan de monetizacion — Colorable (dibujos para colorear con IA)

Fecha: 2026-09-18. Estado: Opcion 1 IMPLEMENTADA y desplegada en https://web-vercel-seven-nu.vercel.app. Opcion 3 PENDIENTE para manana.

## Contexto
- API: `https://death-image.ashlynn.workers.dev/generate` (FLUX-schnell probable, 2-3s, gratis, sin key/captcha).
- Calidad "paila" para arte premium, perfecta para line-art infantil.
- Web actual: `c:\Users\USER\Downloads\freegen\web-vercel\` (index.html + app.js + style.css + api/image.js proxy CORS).
- Decision previa: implementar Opcion 1 ahora, Opcion 3 despues.

## Opciones originales (las 3 que elegiste)
### Opcion 1 — Coloring pages (IMPLEMENTADA)
Convertir la baja calidad en ventaja: generacion -> filtro Sobel line-art -> imprimir.
Nicho: ninos, papas, profes. Volumen SEO alto, CPC alto en AdSense, upsell premium natural.

### Opcion 2 — Thumbnails / memes / placeholders en lote (DESCARTADA por ahora)
Batch de 6 en 10s para YouTube/blogs/memes. Freemium 10 gratis/dia, $7/mes ilimitado, o revender creditos con cache+cola+key.
No hacer: arte premium, retratos, logos (schnell deforma caras/texto).

### Opcion 3 — SEO programatico (PENDIENTE, te cautivo, sigue manana)
No 1 web sino miles de paginas estaticas automaticas (wallpapers, avatares, fondos).
Script genera prompts -> imagenes death-image -> paginas estaticas en Vercel/Cloudflare Pages.
Solo AdSense + afiliados. Ej: 5.000 paginas x 10 visitas/dia x $10 RPM = ~$500/mes piloto automatico.

## Mejoras propuestas (de "brutal" a producto que monetiza)
### Nivel 1 — Conversion (hacer primero)
1. Colorear en navegador: canvas con paleta + pincel + borrador + deshacer + guardar PNG. Retencion 20min, compartir resultado.
2. Libro PDF: juntar 8-12 dibujos en PDF con portada "Mi libro de [nombre]". Gratis con watermark / $3 sin watermark.
3. Antes/despues: miniatura original color + line-art lado a lado. Confianza.

### Nivel 2 — Retencion y viralidad
4. Galeria publica + historial local (localStorage), "recien creados por otros" con cache.
5. Compartir WhatsApp: descargar + abrir wa.me con PNG. Trafico gratis de papas.
6. Modo aula: "generar 10 de animales de una vez" para profes. Un clic = 10 impresiones.

### Nivel 3 — SEO programatico (la Opcion 3)
7. Paginas estaticas por keyword: `/dibujos-de-dinosaurios-para-colorear`, etc., pre-generadas con 6 dibujos (sin gastar API por visita). 100 paginas x 10 visitas/dia = 1.000 visitas/dia de Google Images.
8. Sitemap + schema ImageObject. Google Images = 80% del trafico del nicho.
9. i18n `/en/coloring-pages`, `/pt/...`. CPC ingles 3-5x espanol. Mismo codigo, triple ingreso.

### Nivel 4 — Monetizacion directa
10. AdSense: 1 anuncio bajo generador + 1 en galeria (no mas, UX infantil). Nicho family = CPC alto.
11. Premium sin friccion: "quita watermark + PDF ilimitado $4.99 unico" con Stripe/LemonSqueezy. Pago unico convierte mejor en LATAM.

## Orden recomendado manana
1. Pincel para colorear en la web (retencion).
2. PDF (upsell).
3. Paginas SEO (Opcion 3, trafico).
