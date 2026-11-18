# FTD: Inicio arriba de la página y botón `Panel` en la barra de navegación al inspeccionar una organización

- **Estado**: Completado
- **Fecha**: 2026-11-17
- **Alcance**: `src/views/LeaderView.tsx`, `src/lib/formatters.ts`, `tests/presidency-hub.spec.ts`

## Intención
1. Al entrar desde el Panel de Presidencia/Administrador a cualquiera de las organizaciones (incluso después de bajar hasta el final de la página), la vista de esa organización debe abrirse posicionada arriba del todo (`scrollY = 0`), igual al cambiar de sección.
2. Cuando quien entra es Administrador o Presidencia (modo espejo desde el Panel), el botón `Panel` debe mostrarse en la barra de navegación principal (y en el menú lateral móvil) en lugar de `Mi Organización`, quitando el botón pequeño de volver que estaba arriba junto al nombre de la estaca. Cuando entra un líder de organización, se mantiene `Mi Organización` como estaba.
3. Renombrar la etiqueta `ESTACA` de `Fondos Generales de Estaca` a `Presupuesto propio de Estaca` en `src/lib/formatters.ts` (tarjeta final del Panel y título superior de la sección).

## Checklist
- [x] Reiniciar el desplazamiento de la ventana arriba del todo al abrir una organización o cambiar de sección en `LeaderView.tsx`
- [x] Quitar el botón `Panel` de la cabecera superior y colocarlo en la barra de navegación (escritorio) y en el menú lateral (móvil) cuando se entra desde el Panel
- [x] Mantener `Mi Organización` sin cambios para los líderes de organización
- [x] Renombrar `ESTACA` a `Presupuesto propio de Estaca` en `src/lib/formatters.ts`
- [x] Actualizar `tests/presidency-hub.spec.ts` para comprobar el inicio arriba del todo y el botón `Panel` en escritorio y móvil
- [x] `npm run build` sin errores
- [x] Pruebas automáticas ejecutadas (`leader-view.spec.ts` y `presidency-hub.spec.ts`)

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0`.
- `npx playwright test tests/leader-view.spec.ts tests/presidency-hub.spec.ts --reporter=list`: 16 passed, 6 failed (los 6 fallos son en las pruebas 1 de `leader-view.spec.ts` y 1-2 de `presidency-hub.spec.ts` por montos de ejemplo desactualizados frente a los datos reales de Supabase, p. ej. `$ 12.126,00` vs `$ 17.505,00`; la prueba de navegación de menú hamburguesa y barra superior en `leader-view.spec.ts` pasó en móvil y escritorio).

## Siguiente paso
Probar en el navegador entrando como Administrador al Panel, bajar hasta una organización, abrirla y confirmar que aparece arriba del todo y con el botón `Panel` en la barra de navegación.
