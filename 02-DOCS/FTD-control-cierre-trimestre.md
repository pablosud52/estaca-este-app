# FTD: Control de cierre de trimestre en Administración de Finanzas

- **Estado**: Completado
- **Fecha**: 2026-11-22
- **Alcance**: `src/components/AdminOperationsCenter.tsx`, `tests/projected-activities.spec.ts`

## Intención
Agregar un bloque desplegable (cerrado por defecto) en la parte superior de **Administración de Finanzas** que permita verificar en segundos los 3 puntos clave antes de cerrar un trimestre:
1. **Actividades vencidas sin rendir** (con botón directo a **Proyectados**).
2. **Retiros de efectivo sin cerrar** (con botón directo a **Retiros**).
3. **Comprobantes pendientes de LCR** (con botón directo a **Pend. LCR**).
Cuando los 3 controles están en cero, indica que el trimestre está **Listo para cerrar**.

## Checklist
- [x] Agregar estado colapsable (`isQuarterChecklistOpen`, cerrado por defecto) y métricas del trimestre actual en `AdminOperationsCenter.tsx`
- [x] Renderizar franja blanca limpia con resumen en 1 línea y 3 filas de control con accesos directos a **Proyectados**, **Retiros** y **Pend. LCR**
- [x] Agregar verificación en `tests/projected-activities.spec.ts` y validar `npm run build` sin errores

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0` (18.13s).
- `npx playwright test tests/projected-activities.spec.ts --project="Desktop Chrome"`: `1 passed` (21.7s), verificando la apertura del **Control de cierre** y el salto directo a **Proyectados (2)**.
