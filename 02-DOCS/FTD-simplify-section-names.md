# FTD: Simplificación de Nombres de Secciones (`Proveedores` y `Directorio`)

- **Estado**: Completado
- **Fecha**: 2026-11-14
- **Alcance**: `src/views/LeaderView.tsx`, `src/views/PresidencyHub.tsx`, `src/views/SuppliersView.tsx`, `src/views/LeadersDirectoryView.tsx`, `tests/leader-view.spec.ts`

## Intención
Unificar los nombres de las secciones y sus botones de acceso móvil/escritorio a **Proveedores** (antes `Directorio de Proveedores`) y **Directorio** (antes `Directorio de Líderes` / `Directorio de Líderes de Estaca`), manteniendo intactos el subtítulo actual de `LeadersDirectoryView` y los registros históricos en `02-DOCS/DECISION_LOG.md`.

## Checklist
- [x] Drawer móvil en `LeaderView.tsx` y `PresidencyHub.tsx` actualizado a `Proveedores` y `Directorio`
- [x] Encabezado en `SuppliersView.tsx` actualizado a `Proveedores`
- [x] `aria-label` y `<h2>` en `LeadersDirectoryView.tsx` actualizados a `Directorio`
- [x] `tests/leader-view.spec.ts` actualizado
- [x] `npm run build` sin errores
- [x] Pruebas Playwright ejecutadas (`leader-view.spec.ts` 14/14 aprobadas; `users-directory.spec.ts` 7/8 aprobadas; `presidency-hub.spec.ts` 6/8 aprobadas; 3 fallos preexistentes ajenos al cambio de nombres)

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0`.
- `npx playwright test tests/leader-view.spec.ts tests/presidency-hub.spec.ts tests/users-directory.spec.ts --reporter=list`: **27 passed, 3 failed** (1.4m):
  - `tests/leader-view.spec.ts`: 14/14 aprobadas (Mobile y Desktop).
  - `tests/users-directory.spec.ts`: 7/8 aprobadas (Desktop 4/4; fallo en Mobile en línea 99 buscando botón `Panel` de escritorio).
  - `tests/presidency-hub.spec.ts`: 6/8 aprobadas (fallo en test 4 línea 234 por `approval-permission-readonly`).

## Siguiente paso
Revisar si quieres subir estos cambios a GitHub, Vercel y Google Drive.
