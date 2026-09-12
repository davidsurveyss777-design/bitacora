# Bitácora

Tu asistente personal: chat con IA, tareas y notas, instalable como app en tu
ordenador (PWA). Tareas y notas se guardan en el propio navegador; el chat
pasa por una función serverless que guarda la clave de la API (Groq) en el
servidor, nunca en el navegador.

## Desarrollo local

```bash
npm install
npm run dev
```

El chat no funcionará en local a menos que sirvas también la función de
`functions/api/chat.js` (Cloudflare) — para probarlo en local usa
`npx wrangler pages dev` en vez de `vite dev`, o despliega directamente.

## Desplegar en Cloudflare Pages

1. Sube este proyecto a un repo de GitHub.
2. En Cloudflare Pages → **Create a project** → conecta el repo.
3. Build command: `npm run build` — Output directory: `dist`
4. En **Settings → Environment variables**, añade `GROQ_API_KEY` con tu
   clave de la API de Groq (console.groq.com/keys — nivel gratuito).
5. Despliega. La función en `functions/api/chat.js` se activa sola en
   `/api/chat` — no hace falta configurar nada más.

## Desplegar en Netlify (alternativa)

Netlify usa funciones en `netlify/functions/` en vez de `functions/api/`.
Si prefieres Netlify:
1. Crea `netlify/functions/chat.js` con la misma lógica que
   `functions/api/chat.js`, adaptando el handler al formato de Netlify
   Functions (`exports.handler = async (event) => {...}`).
2. Cambia en `src/App.jsx` la URL `/api/chat` por `/.netlify/functions/chat`.
3. Añade `ANTHROPIC_API_KEY` en Netlify → Site settings → Environment
   variables.

## Instalarlo como app de escritorio

Una vez desplegado (Cloudflare Pages o Netlify te dan una URL https),
ábrelo en Chrome o Edge y usa el icono de instalación en la barra de
direcciones (o menú → "Instalar Bitácora"). Se abrirá como una app
independiente, con su propio icono, sin las pestañas del navegador —
funciona igual en Windows, Mac y Linux.

## Estructura

- `src/App.jsx` — toda la interfaz (chat, tareas, notas)
- `functions/api/chat.js` — proxy serverless hacia la API de Anthropic
- `vite.config.js` — config de Vite + plugin PWA (manifest, icono, instalable)
