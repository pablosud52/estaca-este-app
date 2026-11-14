# FTD: Menú Hamburguesa y Limpieza de Botones en Vista de Líderes (`LeaderView`)

- **Estado**: Completado
- **Fecha**: 2026-11-13
- **Alcance**: `src/views/LeaderView.tsx`, `tests/leader-view.spec.ts`, `tests/calendar-view.spec.ts`

## Intención
Unificar la navegación de la vista de Líderes (`LeaderView`) con el patrón de menú hamburguesa + Drawer lateral móvil y barra de navegación de escritorio utilizado en `PresidencyHub`, retirando los botones de navegación secundaria incrustados dentro de tarjetas y acordeones.

## Alcance del cambio
1. **Cabecera y Navegación (`LeaderView.tsx`)**:
   - Agregar botón hamburguesa (`mobile-menu-toggle`, `☰` → `✕`) a la izquierda en móvil (`md:hidden`) con Drawer lateral (`mobile-nav-drawer` + `backdrop-blur-sm`) y tarjeta de identidad del usuario (`drawer-user-name`).
   - Agregar barra `<nav>` horizontal en escritorio (`hidden md:flex`) con las 3 secciones del líder:
     - `Mi Organización` (`SUMMARY`)
     - `Calendario` (`CALENDAR`)
     - `Proveedores` (`SUPPLIERS`)
   - Mantener el botón `← Panel` (`back-to-hub-btn`) en cabecera cuando Presidencia/Admin inspecciona una organización en modo espejo (`onBackToHub`).
2. **Limpieza de botones en tarjetas**:
   - Retirar `open-suppliers-view-btn` (`Proveedores`) de la tarjeta `Próxima Actividad`, dejando `+ Proponer Actividad` como único botón protagonista.
   - Retirar `open-full-calendar-view-btn` (`Ver Calendario General y Filtros`) del interior del acordeón `Calendario Anual de Actividades`.
3. **Pruebas E2E**:
   - Actualizar `tests/calendar-view.spec.ts` y `tests/leader-view.spec.ts` para reflejar la nueva navegación por menú hamburguesa / barra de escritorio.
   - Verificar `npm run build` y la suite de Playwright en `Mobile Chrome` y `Desktop Chrome`.

## Checklist
- [x] Menú hamburguesa móvil + Drawer lateral y barra de navegación escritorio implementados en `src/views/LeaderView.tsx`
- [x] Botones `Proveedores` y `Ver Calendario General y Filtros` retirados de tarjetas/acordeones
- [x] `tests/calendar-view.spec.ts` y `tests/leader-view.spec.ts` actualizados
- [x] `npm run build` sin errores de TypeScript/Vite
- [x] Suite Playwright (`leader-view.spec.ts` y `calendar-view.spec.ts`) pasando en Mobile y Desktop

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code 0, bundle generado en `dist/`.
- `npx playwright test tests/leader-view.spec.ts tests/calendar-view.spec.ts --reporter=list`: **18 passed (50.5s)** cubriendo `Mobile Chrome` y `Desktop Chrome`.

## Siguiente paso
Revisar visualmente la vista de líderes en navegador o continuar con el siguiente ajuste de UI.
