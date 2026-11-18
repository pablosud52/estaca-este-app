# FTD — Cierre automático de retiros, eliminación de cierre manual y corrección de fechas 2025

## Intención
Eliminar el cierre manual de retiros ("Cerrar en $ 0,00") para que ningún retiro pase a cerrado sin una transacción real (gasto o depósito vinculado), filtrar los movimientos por año y mover los dos retiros de diciembre 2025 (`1205-55000` y `1226-30000`) a su año correcto.

## Alcance
- Base de datos Supabase (`cash_withdrawals`): corregir `withdrawal_date` de `1205-55000` (`2025-12-05`) y `1226-30000` (`2025-12-26`).
- `src/data/seedData.ts`: corregir las mismas dos fechas en `SEED_CASH_WITHDRAWALS`.
- `src/components/AdminOperationsCenter.tsx`:
  - Filtrar `withdrawals` por `selectedYear`.
  - Calcular `pendingToRender` y estado (`Abierto` / `Cerrado`) automáticamente desde las transacciones reales (`amount - renderedAmount - returned_amount`).
  - Eliminar el botón y formulario manual "Cerrar en $ 0,00".
  - Pasar `openWithdrawals` a `NewMovementModal`.
- `src/components/NewMovementModal.tsx` y `src/views/PresidencyHub.tsx`:
  - Permitir vincular un **Depósito** a un retiro abierto (o aplicarlo en orden FIFO) para reducir su saldo pendiente y cerrarlo automáticamente al llegar a `$ 0,00`.

## Checklist
- [x] Actualizar fechas 2025 en Supabase (`1205-55000` y `1226-30000`) y en `src/data/seedData.ts`.
- [x] Filtrar movimientos por `selectedYear` y calcular estado automático sin botón manual en `AdminOperationsCenter.tsx`.
- [x] Vincular depósitos a retiros abiertos en `NewMovementModal.tsx` y `PresidencyHub.tsx`.
- [x] Verificar con `npx tsc --noEmit` y `npm run build`.

## Evidencia
- SQL ejecutado en Supabase (`cash_withdrawals`): `1205-55000` actualizado a `2025-12-05` y `1226-30000` actualizado a `2025-12-26`.
- `npx tsc --noEmit` y `npm run build` ejecutados sin errores (código de salida 0, `vite v6.4.5 building for production...` completado en 15.73s).

## Siguiente paso
Revisar en la app que `1205-55000` y `1226-30000` ya no aparecen en 2026 y que ningún retiro tiene botón de cierre manual.
