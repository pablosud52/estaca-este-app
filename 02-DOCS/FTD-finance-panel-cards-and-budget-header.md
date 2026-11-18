# FTD — Rediseño de tarjetas en Administración de Finanzas y cabecera de Presupuestos

## Intención
Reemplazar las tarjetas superiores de **Administración de Finanzas** por los 3 indicadores operativos que necesita el administrador (dejando el cuarto espacio reservado), quitar el subtítulo del encabezado y alinear las subpestañas de **Presupuestos** a la izquierda sin el contador anual.

## Alcance
- `src/components/AdminOperationsCenter.tsx`

## Checklist
- [x] Quitar subtítulo debajo de `Administración de Finanzas`.
- [x] Tarjeta 1: **Presupuesto Global** (`totalAssigned - appliedNonReimbursableSpent` para `selectedYear`).
- [x] Tarjeta 2: **Monto en Efectivo** (`totalWithdrawn - totalCashExpenses - totalCashDeposits`).
- [x] Tarjeta 3: **Pendientes en LCR** (`pendingLcrTotalAmount`) con sub-indicador inferior `Efectivo − Pend. LCR` (`cashOnHand - pendingLcrTotalAmount`).
- [x] Tarjeta 4: Espacio vacío reservado manteniendo la grilla de 4 columnas.
- [x] Pestaña **Presupuestos**: mover las 2 subpestañas a la izquierda con separación respecto al título y quitar el contador `Total Anual`.
- [x] Verificar compilación TypeScript y build de producción (`npm run build`).

## Evidencia
- `npx tsc --noEmit` y `npm run build` ejecutados sin errores (código de salida 0, `vite v6.4.5 building for production...` completado en 18.76s).

## Siguiente paso
Revisar en pantalla los nuevos valores y confirmar si se requiere ajustar algún texto o alerta en la cuarta tarjeta.
