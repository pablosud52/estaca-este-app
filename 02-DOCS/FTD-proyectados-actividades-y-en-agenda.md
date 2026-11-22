# FTD: Seguimiento de Actividades en Proyectados y En Agenda

- **Estado**: Completado
- **Fecha**: 2026-11-22
- **Alcance**: `src/components/AdminOperationsCenter.tsx`, `src/components/ExpenseFormModal.tsx`, `src/views/PresidencyHub.tsx`, `tests/projected-activities.spec.ts`

## Intención
Unificar el ciclo de vida de las actividades con presupuesto para que ninguna quede sin seguimiento financiero ni libere saldo proyectado por error al pasar su fecha:
1. **Proyectados como bandeja de trabajo real**: toda actividad aprobada con presupuesto (`estimated_cost > 0`) sin cierre debe verse en **Finanzas → Gastos → Proyectados**, ordenada por urgencia (primero vencidas "Pendiente de rendir", luego próximas por fecha).
2. **Seguimiento continuo en "En agenda"**: una actividad con presupuesto (incluso si ya pasó su fecha o viene de un trimestre anterior del año) debe seguir figurando en **En agenda** del Panel y descontando del **Saldo libre estimado** hasta que reciba un destino explícito (gasto real o cierre sin gasto).
3. **Acciones directas en Proyectados**:
   - Botón **"Pasar a gasto"**: abre el formulario directamente en modo **Gasto Real** con la actividad, organización, fecha y concepto precargados.
   - Botón **"Cerrar sin gasto"**: permite cerrar la reserva financiera sin eliminar la actividad del calendario (ej. evento gratuito o suspendido).
4. **Pagos parciales / múltiples facturas (opcional)**: al rendir un gasto vinculado a una actividad proyectada, permitir elegir entre **cerrar la actividad** (por defecto, gasto unificado) o **dejar el remanente abierto** para cargar comprobantes adicionales.

## Checklist
- [x] Asegurar que toda actividad aprobada con `estimated_cost > 0` sin cierre aparezca en **Proyectados** (incluyendo actividades previas sin fila proyectada generada)
- [x] Ordenar **Proyectados** poniendo primero las vencidas ("Pendiente de rendir") y luego las próximas por fecha
- [x] Actualizar `reservedMetrics` en `PresidencyHub.tsx` para mantener en **En agenda** y en **Reservado Actividades** toda actividad pendiente de cierre aunque su fecha ya haya pasado
- [x] Agregar botón rápido **"Pasar a gasto"** en filas de **Proyectados** que abra `ExpenseFormModal` preconfigurado en modo **Gasto Real**
- [x] Agregar acción **"Cerrar sin gasto"** para archivar reservas sin gasto sin borrar la actividad del calendario
- [x] Agregar opción en `ExpenseFormModal` al rendir desde un proyectado: *"Cerrar actividad con este gasto"* vs *"Dejar remanente pendiente (pago parcial)"*
- [x] Actualizar/agregar pruebas automatizadas y verificar `npm run build` sin errores

## Orden de construcción sugerido
1. **Paso 1 — Lógica de Panel ("En agenda" y Saldo Proyectado)**: mantener actividades vencidas sin cierre dentro del cálculo de reservado y la lista **En agenda**.
2. **Paso 2 — Bandeja Proyectados completa y ordenada**: incluir actividades aprobadas con presupuesto que aún no tenían fila proyectada y ordenar por urgencia.
3. **Paso 3 — Acciones rápidas ("Pasar a gasto" y "Cerrar sin gasto") + opción de pago parcial** en la tabla y en el modal de gastos.
4. **Paso 4 — Pruebas y validación final**.

## Evidencia
- `npm run build` (`tsc -b && vite build`): exit code `0` (15.24s).
- `npx playwright test tests/projected-activities.spec.ts --project="Desktop Chrome"`: `1 passed` (29.8s).

## Siguiente paso
Probar en la aplicación el flujo de **Proyectados** y confirmar si continuamos con el siguiente bloque de mejoras (por ejemplo, tocar una organización en **En agenda** para ir directo a **Proyectados**, o tildar varios gastos en lote para LCR).
