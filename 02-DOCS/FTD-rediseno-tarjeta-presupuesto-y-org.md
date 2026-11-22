# FTD: Rediseño visual de la tarjeta principal (Presidencia y Organizaciones) + Saldo comprometido por Organización

- **Estado**: Completado
- **Fecha**: 2026-11-22
- **Alcance**: `src/views/PresidencyHub.tsx`, `src/views/LeaderView.tsx`, `tests/projected-activities.spec.ts`

## Intención
1. Unificar la estética de la tarjeta financiera principal tanto en el **Panel de Presidencia** como en la vista de **cada Organización** (Líderes y Modo Espejo) inspirada en una paleta sobria de azul marino con degradado suave, sin íconos, con números en blanco limpio, etiquetas en blanco suave y líneas divisoras finas.
2. Invertir la jerarquía visual para poner el **Saldo libre estimado** como protagonista principal arriba (en rojo suave solo si queda negativo), seguido debajo por **Disponible actual** y **Comprometido en actividades** (y en Organizaciones también **Gastos realizados**).
3. En la columna lateral **En agenda** del Panel de Presidencia, quitar el amarillo chillón y usar la misma paleta limpia en blanco/blanco suave.
4. En **cada Organización**, calcular y mostrar siempre **Comprometido en actividades** y **Saldo libre estimado** con las mismas reglas que Presidencia (incluye actividades pendientes vencidas y remanentes de pagos parciales; excluye históricas `ACT-2026-*`, rechazadas y canceladas).

## Checklist
- [x] Rediseñar tarjeta maestra de **Presidencia** (`PresidencyHub.tsx`): degradado azul sobrio, sin íconos, **Saldo libre estimado** protagonista, **Disponible actual** y **Comprometido** debajo con líneas finas, y columna lateral **En agenda** en blanco/blanco suave
- [x] Calcular `reservedOrgAmount` y `estimatedFreeBalance` en `LeaderView.tsx` con la misma regla unificada que `PresidencyHub.tsx`
- [x] Rediseñar tarjeta maestra de **Organización** (`LeaderView.tsx`) con la misma estética y jerarquía (mostrando siempre **Saldo libre estimado**, **Disponible actual**, **Comprometido en actividades** y **Gastos realizados**)
- [x] Actualizar pruebas en `tests/projected-activities.spec.ts` para verificar ambas tarjetas y validar `npm run build` sin errores

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0` (15.97s).
- `npx playwright test tests/projected-activities.spec.ts --project="Desktop Chrome"`: `1 passed` (15.3s), verificando Panel de Presidencia (`$ 25.000,00` comprometido), tarjeta de Organización (`Adultos Solteros` con `$ 15.000,00` comprometido y saldo libre estimado) y flujo completo de `Proyectados (2)`.
