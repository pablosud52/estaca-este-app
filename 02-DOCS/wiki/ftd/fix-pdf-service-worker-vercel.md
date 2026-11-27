---
author: pablosud52
branch: main
status: completed
---
# FTD: Corregir apertura de PDFs de Normativas en producción (Vercel / Service Worker)

## Intent
En la versión desplegada en Vercel (`https://estacaeste.vercel.app`), al abrir cualquier PDF desde **Administración → Normativas → `Ver PDF oficial`** (tanto en el visor modal como en nueva pestaña), el navegador mostraba una ventana con el propio panel de la aplicación en lugar del documento PDF.

Causa raíz reproducida localmente contra `vite preview` (`dist/sw.js`):
`VitePWA` en `vite.config.ts` registraba `NavigationRoute(createHandlerBoundToURL("index.html"))` sin `navigateFallbackDenylist` y sin precachear `*.pdf`. Toda navegación a `/docs/normativas/*.pdf` (en `<iframe>` o `<a target="_blank">`) era interceptada por el Service Worker y reemplazada por `index.html`.

## Scope
- **Incluido**:
  - `vite.config.ts`: agregar `workbox.navigateFallbackDenylist` excluyendo `/^\/docs\//`, `/^\/api\//` y `/\.pdf($|\?)/i` del fallback hacia `index.html`.
  - `package.json`: agregar `"pretest:e2e": "vite build"` para asegurar que `dist/sw.js` esté compilado y actualizado al correr `npm run test:e2e`.
  - `tests/normativas-sw.spec.ts`: prueba de regresión contra el build de producción (`vite preview` con Service Worker activo) verificando que los 3 PDFs de Normativas carguen con `Content-Type: application/pdf` (en navegación directa y en `<iframe>`), que falle rápido si falta `dist/sw.js` o si `vite preview` termina antes de responder, y que `#root` no aparezca en el visor.
  - `tests/normativas.spec.ts`: esperar a que `hub-admin-menu-trigger` esté montado en el DOM y ampliar la espera de carga diferida de `financial-info-section` (`15s`).
  - `02-DOCS/wiki/sdd/decisions.md`: registrar la causa raíz y solución para diagnóstico futuro.
- **Excluido**:
  - Cambios en la UI de `PdfViewerModal.tsx` o `FinancialInfoSection.tsx` (no son la causa del fallo).
  - Precacheo de los 3 PDFs en Workbox (evita descargar 1,2 MB extra a perfiles de Líderes que no acceden a Normativas).

## Checklist
- [x] Reproducir el secuestro de navegación de `/docs/normativas/*.pdf` en build de producción (`vite preview`) con Service Worker activo.
- [x] Escribir prueba de regresión en `tests/normativas-sw.spec.ts` y comprobar que fallaba antes del arreglo (`text/html;charset=utf-8`).
- [x] Configurar `workbox.navigateFallbackDenylist` en `vite.config.ts`.
- [x] Recompilar (`npm run build`) y verificar que `dist/sw.js` excluye `/docs/`, `/api/` y `.pdf` del `NavigationRoute`.
- [x] Verificar compilación, pruebas de regresión SW y suite E2E de Normativas en verde (`8 passed`).
- [x] Pasar revisión de riesgo (`npx @ericrisco/rsc risk` → `tier 1`) y resolver observaciones del revisor.

## Evidence
- **Reproducción previa al arreglo (`vite preview` con `dist/sw.js` anterior)**:
  - `{"swReady":true,"controlled":true,"status":200,"navContentType":"text/html;charset=utf-8","navTitle":"Estaca Este App — Finanzas y Calendario","navHasRoot":1}`
  - `tests/normativas-sw.spec.ts` falló antes del arreglo esperando `"application/pdf"` y recibiendo `"text/html;charset=utf-8"`.
- **Compilación de producción (`npm run build`)**:
  - `tsc -b && vite build` completado en `18.68s`, generando `dist/sw.js` con `NavigationRoute(createHandlerBoundToURL("index.html"),{denylist:[/^\/docs\//,/^\/api\//,/\.pdf($|\?)/i]})`.
- **Pruebas Playwright (`npx playwright test tests/normativas-sw.spec.ts tests/normativas.spec.ts --reporter=line`)**:
  - **`8 passed (44.9s)`** (`Mobile Chrome` y `Desktop Chrome` en `tests/normativas-sw.spec.ts` y `tests/normativas.spec.ts`).
- **Suite completa (`npm run test:e2e`)**: no ejecutada en su totalidad (solo se ejecutaron las suites de Normativas y Service Worker).

## Next
- Subir los cambios a GitHub (`git push` a `main`) para que Vercel despliegue el nuevo `sw.js` y probar en `https://estacaeste.vercel.app`.
