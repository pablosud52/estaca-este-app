---
author: Pablo Lamela
branch: main
status: completed
---
# FTD: Reubicación del Botón Hamburguesa a la Izquierda en Versión Móvil

## Intent
Ubicar el botón tipo hamburguesa (`mobile-menu-toggle`) de forma permanente en el extremo izquierdo de la cabecera en la versión móvil del Hub Ejecutivo de Presidencia (`PresidencyHub.tsx`), respetando la ergonomía y patrones nativos de aplicaciones móviles, y alineándose de forma natural con el Drawer lateral que se despliega desde la izquierda.

## Scope
- **Incluido**:
  - `src/views/PresidencyHub.tsx`:
    - Reubicar el botón `mobile-menu-toggle` al inicio del contenedor flex izquierdo de la cabecera móvil (`md:hidden`).
    - Mantener el distintivo de "Estaca Montevideo Uruguay Este" en el centro/izquierda y el selector de año fiscal junto con el usuario activo en el bloque derecho.
    - Asegurar espaciado limpio y truncamiento para evitar desbordes horizontales en pantallas estrechas (360px+).
  - `tests/presidency-hub.spec.ts`:
    - Validar que las pruebas E2E existentes de interacción con el botón hamburguesa y navegación sigan pasando al 100%.
  - Sincronización con GitHub y copia de Google Drive.

- **Excluido**:
  - Modificación de la barra de navegación de escritorio (`md:flex`), la cual se mantiene oculta en móvil y visible en PC.

## Checklist
- [x] Reubicar botón hamburguesa a la izquierda en `src/views/PresidencyHub.tsx`.
- [x] Ejecutar compilación exitosa (`npm run build`).
- [x] Ejecutar suite completa de pruebas E2E en Playwright (`npm run test:e2e`).
- [x] Realizar commit y push a GitHub (`main`).
- [x] Sincronizar directorio en Google Drive (`g:\Mi unidad\GitHub\estaca-este-app`).

## Evidence
- `npm run build`: compilación limpia en 17.14s con `sw.js` de PWA generado.
- `npm run test:e2e`: 30 de 30 pruebas pasadas exitosamente (1.2m) en Mobile Chrome y Desktop Chrome.

## Next
- Subir a GitHub y sincronizar con Google Drive.
