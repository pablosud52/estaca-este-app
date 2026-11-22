# FTD: Conciliación en lote de comprobantes pendientes en LCR

- **Estado**: Completado
- **Fecha**: 2026-11-22
- **Alcance**: `src/components/AdminOperationsCenter.tsx`, `tests/projected-activities.spec.ts`

## Intención
Permitir al administrador / secretario financiero marcar varios gastos pendientes de LCR como registrados en una sola operación:
1. Mostrar contador en el filtro **Pend. LCR (N)** cuando existan comprobantes pendientes.
2. Cuando haya comprobantes pendientes de LCR en pantalla (y el usuario tenga permiso de edición), habilitar casillas de selección por fila (escritorio y móvil) y una barra compacta con **"Seleccionar todos"** y **"Marcar N en LCR"**.
3. Al confirmar en lote, conciliar todos los gastos seleccionados en un solo llamado y mostrar confirmación. Cuando no haya pendientes, no agregar ruido visual a la tabla.

## Checklist
- [x] Agregar contador al botón de filtro `Pend. LCR (N)` cuando haya pendientes
- [x] Agregar selección múltiple (`selectedLcrKeys`) con casilla por fila pendiente (escritorio y móvil) y barra de acción en lote (`Seleccionar todos` / `Marcar N en LCR`)
- [x] Conectar la acción en lote con `onReconcileLcrExpenseGroup` y feedback en toast
- [x] Verificar `npm run build` y `tests/projected-activities.spec.ts` sin errores

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0` (23.82s).
- `npx playwright test tests/projected-activities.spec.ts --project="Desktop Chrome"`: `1 passed` (24.3s).
