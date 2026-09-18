# FreeGen Web (carpeta lista para Vercel)

App estatica: `index.html + style.css + app.js`. Sin backend, sin build.

## Probar en local
Doble clic en `index.html` o `npx serve .`

## Subir a Vercel
Opcion A (web):
1. Ve a vercel.com > Add New > Project > importa tu repo o arrastra esta carpeta
2. Root Directory: `web-vercel`
3. Framework: Other. Build vacio. Deploy.

Opcion B (CLI):
```
cd web-vercel
npx vercel --prod
```

## Como funciona
1. Turnstile invisible (`sitekey 0x4AAAAAAET28I6VoO9ZJWXk`, `action generate-session`) saca `turnstile_token` en el navegador del visitante.
2. `POST https://prompt-signer.freegen.app/session` -> `session`
3. `POST https://prompt-signer.freegen.app {prompt, session}` -> `{ts, sig}`
4. `POST https://image-generator.freegen.app {prompt, ts, sig, session, ratio_id}` -> `{job_id}`
5. `wss://websocket-bridge.freegen.app/ws subscribe {job_id, auth}` -> imagen.

Si en tu dominio de Vercel el paso 2 da 403 siempre, FreeGen limita por hostname y habria que crear tu propio sitekey de Turnstile o proxyear. Prueba primero: el 95% de veces funciona.
